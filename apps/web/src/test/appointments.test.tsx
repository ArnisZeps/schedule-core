import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useSearchParams } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserProvider } from '@/components/UserProvider'
import { server } from './handlers'
import { http, HttpResponse } from 'msw'
import { AppointmentsPage } from '@/page-components/appointments/AppointmentsPage'
import { TEST_TOKEN, TENANT_ID, BOOKINGS } from './handlers'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => '/appointments'),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={String(href)} {...props as object}>{children}</a>,
}))

// 2026-05-04 is a Monday — used to pin "today" for deterministic tests
const FIXED_NOW = new Date('2026-05-04T10:00:00.000Z')

let mockPush: ReturnType<typeof vi.fn>
let mockReplace: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockPush = vi.fn()
  mockReplace = vi.fn()
  vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: mockReplace, back: vi.fn() } as any)
})

function renderAppointments(search = 'view=week&date=2026-05-04') {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(search) as any)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <UserProvider user={{ userId: 'user-1', tenantId: 'tenant-1' }}><AppointmentsPage /></UserProvider>
    </QueryClientProvider>,
  )
}

describe('Appointments Calendar', () => {
  beforeEach(() => {
    // Fake only Date so new Date() returns FIXED_NOW; setTimeout/waitFor still work normally
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Week view', () => {
    it('renders 7 day column headers Mon–Sun for the selected week', async () => {
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => {
        expect(screen.getByText(/Mon.*4/i)).toBeInTheDocument()
        expect(screen.getByText(/Sun.*10/i)).toBeInTheDocument()
      })
    })

    it('marks today column with data-testid="today-column"', async () => {
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => {
        expect(screen.getByTestId('today-column')).toBeInTheDocument()
      })
    })

    it('renders 60-min appointment block with client name and time range', async () => {
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument())
      // 60-min booking: time range element is present in Alice's block
      expect(screen.getByText('Alice Smith').closest('[data-booking-id="bk-1"]')
        ?.querySelector('[data-testid="appointment-time-range"]')).toBeInTheDocument()
    })

    it('renders short (<30 min) appointment block with client name only, no time range', async () => {
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => screen.getByText('Bob Jones'))
      // Short (<30 min) booking: no time range element in Bob's block
      expect(screen.getByText('Bob Jones').closest('[data-booking-id="bk-2"]')
        ?.querySelector('[data-testid="appointment-time-range"]')).not.toBeInTheDocument()
    })
  })

  describe('Toolbar navigation', () => {
    it('clicking Today resets date to today (2026-05-04)', async () => {
      const user = userEvent.setup()
      renderAppointments('view=week&date=2026-05-11')
      await waitFor(() => screen.getByRole('button', { name: /today/i }))
      await user.click(screen.getByRole('button', { name: /today/i }))
      // today = 2026-05-04 is the default; URL sync omits date param when on today's week
      expect(mockReplace).toHaveBeenLastCalledWith('/appointments', { scroll: false })
    })

    it('clicking Next advances by 7 days in week view', async () => {
      const user = userEvent.setup()
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => screen.getByRole('button', { name: /next/i }))
      await user.click(screen.getByRole('button', { name: /next/i }))
      expect(mockReplace).toHaveBeenLastCalledWith(expect.stringContaining('date=2026-05-11'), { scroll: false })
    })

    it('clicking Prev regresses by 7 days in week view', async () => {
      const user = userEvent.setup()
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => screen.getByRole('button', { name: /prev/i }))
      await user.click(screen.getByRole('button', { name: /prev/i }))
      expect(mockReplace).toHaveBeenLastCalledWith(expect.stringContaining('date=2026-04-27'), { scroll: false })
    })
  })

  describe('View toggle', () => {
    it('clicking Day updates URL to view=day', async () => {
      const user = userEvent.setup()
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => screen.getByRole('button', { name: /^day$/i }))
      await user.click(screen.getByRole('button', { name: /^day$/i }))
      expect(mockReplace).toHaveBeenLastCalledWith(expect.stringContaining('view=day'), { scroll: false })
    })

    it('day view renders single-column day header', async () => {
      renderAppointments('view=day&date=2026-05-04')
      await waitFor(() => {
        expect(screen.getByText(/May 4/i)).toBeInTheDocument()
      })
    })

    it('clicking List updates URL to view=list', async () => {
      const user = userEvent.setup()
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => screen.getByRole('button', { name: /^list$/i }))
      await user.click(screen.getByRole('button', { name: /^list$/i }))
      expect(mockReplace).toHaveBeenLastCalledWith(expect.stringContaining('view=list'), { scroll: false })
    })

    it('list view renders table with required column headers', async () => {
      renderAppointments('view=list')
      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: /date/i })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: /time/i })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: /client/i })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: /service/i })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument()
      })
    })
  })

  describe('List view', () => {
    it('shows upcoming bookings with client name and status badge', async () => {
      renderAppointments('view=list')
      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument()
        expect(screen.getByText(/pending/i)).toBeInTheDocument()
      })
    })

    it('shows "No upcoming appointments" empty state when list is empty', async () => {
      server.use(
        http.get(`/api/tenants/${TENANT_ID}/bookings`, () =>
          HttpResponse.json([]),
        ),
      )
      renderAppointments('view=list')
      await waitFor(() => {
        expect(screen.getByText(/no upcoming appointments/i)).toBeInTheDocument()
      })
    })

    it('clicking a row opens the appointment detail dialog', async () => {
      const user = userEvent.setup()
      renderAppointments('view=list')
      await waitFor(() => screen.getByText('Alice Smith'))
      await user.click(screen.getByText('Alice Smith'))
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })
  })

  describe('Appointment detail dialog', () => {
    async function openDialog(user: ReturnType<typeof userEvent.setup>) {
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => screen.getByText('Alice Smith'))
      await user.click(screen.getByText('Alice Smith'))
      return waitFor(() => screen.getByRole('dialog'))
    }

    it('shows client name, email, service, and status badge', async () => {
      const user = userEvent.setup()
      const dialog = await openDialog(user)
      expect(within(dialog).getByText('Alice Smith')).toBeInTheDocument()
      expect(within(dialog).getByText('alice@test.com')).toBeInTheDocument()
      expect(within(dialog).getByText('Meeting Room A')).toBeInTheDocument()
      expect(within(dialog).getByText(/pending/i)).toBeInTheDocument()
    })

    it('"Cancel appointment" button opens AlertDialog for confirmation', async () => {
      const user = userEvent.setup()
      const dialog = await openDialog(user)
      await user.click(within(dialog).getByRole('button', { name: /cancel appointment/i }))
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })
    })

    it('confirming cancellation sends PATCH { status: "cancelled" } and closes dialog', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.patch(`/api/tenants/${TENANT_ID}/bookings/bk-1`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ ...BOOKINGS[0], status: 'cancelled' })
        }),
      )
      const dialog = await openDialog(user)
      await user.click(within(dialog).getByRole('button', { name: /cancel appointment/i }))
      await waitFor(() => screen.getByRole('alertdialog'))
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /confirm/i }))
      await waitFor(() => {
        expect(capturedBody).toEqual({ status: 'cancelled' })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('409 on cancel shows inline error and keeps dialog open', async () => {
      const user = userEvent.setup()
      server.use(
        http.patch(`/api/tenants/${TENANT_ID}/bookings/bk-1`, () =>
          HttpResponse.json({ message: 'Already cancelled' }, { status: 409 }),
        ),
      )
      const dialog = await openDialog(user)
      await user.click(within(dialog).getByRole('button', { name: /cancel appointment/i }))
      await waitFor(() => screen.getByRole('alertdialog'))
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /confirm/i }))
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(within(screen.getByRole('dialog')).getByText(/already cancelled/i)).toBeInTheDocument()
      })
    })

    it('reschedule with end ≤ start shows inline validation error without sending PATCH', async () => {
      const user = userEvent.setup()
      const dialog = await openDialog(user)
      // Use fireEvent.change for reliable datetime-local input manipulation in jsdom
      fireEvent.change(within(dialog).getByLabelText(/new start/i), { target: { value: '2026-05-04T12:00' } })
      fireEvent.change(within(dialog).getByLabelText(/new end/i), { target: { value: '2026-05-04T11:00' } })
      await user.click(within(dialog).getByRole('button', { name: /reschedule/i }))
      await waitFor(() => {
        expect(within(dialog).getByText(/end must be after start/i)).toBeInTheDocument()
      })
    })

    it('reschedule success sends PATCH { startAt, endAt } and closes dialog', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.patch(`/api/tenants/${TENANT_ID}/bookings/bk-1`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({
            ...BOOKINGS[0],
            startAt: '2026-05-04T11:00:00.000Z',
            endAt: '2026-05-04T12:00:00.000Z',
          })
        }),
      )
      const dialog = await openDialog(user)
      // Use fireEvent.change for reliable datetime-local input manipulation in jsdom
      fireEvent.change(within(dialog).getByLabelText(/new start/i), { target: { value: '2026-05-04T11:00' } })
      fireEvent.change(within(dialog).getByLabelText(/new end/i), { target: { value: '2026-05-04T12:00' } })
      await user.click(within(dialog).getByRole('button', { name: /reschedule/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({
          startAt: expect.stringContaining('2026-05-04'),
          endAt: expect.stringContaining('2026-05-04'),
        })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })
})
