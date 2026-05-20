import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useSearchParams } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserProvider } from '@/components/UserProvider'
import { http, HttpResponse } from 'msw'
import { server } from './handlers'
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

// 2026-05-04T10:00:00Z — bk-1 ends exactly at this time (NOT past); bk-past ends before
const FIXED_NOW = new Date('2026-05-04T10:00:00.000Z')

const PAST_PENDING = {
  ...BOOKINGS[0],
  id: 'bk-past',
  startAt: '2026-05-04T08:00:00.000Z',
  endAt: '2026-05-04T09:00:00.000Z',
  status: 'pending' as const,
  clientName: 'Past Client',
}

const PAST_CANCELLED = {
  ...PAST_PENDING,
  id: 'bk-past-cancelled',
  status: 'cancelled' as const,
  clientName: 'Past Cancelled',
}

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

describe('Calendar appointment improvements', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── Appointment approval ────────────────────────────────────────────────

  describe('Appointment approval', () => {
    async function openDialog(user: ReturnType<typeof userEvent.setup>, bookingId: string) {
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => screen.getByTestId(`booking-block-${bookingId}`))
      await user.click(screen.getByTestId(`booking-block-${bookingId}`))
      return waitFor(() => screen.getByRole('dialog'))
    }

    it('shows Confirm button for a pending appointment', async () => {
      const user = userEvent.setup()
      const dialog = await openDialog(user, 'bk-1')
      expect(within(dialog).getByRole('button', { name: /confirm appointment/i })).toBeInTheDocument()
    })

    it('does not show Confirm button for a confirmed appointment', async () => {
      const user = userEvent.setup()
      const dialog = await openDialog(user, 'bk-2')
      expect(within(dialog).queryByRole('button', { name: /confirm appointment/i })).not.toBeInTheDocument()
    })

    it('clicking Confirm sends PATCH { status: "confirmed" } and closes dialog', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.patch(`/api/tenants/${TENANT_ID}/bookings/bk-1`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ ...BOOKINGS[0], status: 'confirmed' })
        }),
      )
      const dialog = await openDialog(user, 'bk-1')
      await user.click(within(dialog).getByRole('button', { name: /confirm appointment/i }))
      await waitFor(() => {
        expect(capturedBody).toEqual({ status: 'confirmed' })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  // ─── Past appointment visual state ───────────────────────────────────────

  describe('Past appointment visual state', () => {
    it('past pending appointment block has opacity-50 class', async () => {
      server.use(
        http.get(`/api/tenants/${TENANT_ID}/bookings`, () =>
          HttpResponse.json([PAST_PENDING]),
        ),
      )
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => screen.getByTestId('booking-block-bk-past'))
      const block = screen.getByTestId('booking-block-bk-past')
      expect(block.className).toContain('opacity-50')
    })

    it('appointment ending exactly at now is not treated as past', async () => {
      // bk-1 endAt = FIXED_NOW exactly — not strictly less than, so not past
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => screen.getByTestId('booking-block-bk-1'))
      const block = screen.getByTestId('booking-block-bk-1')
      expect(block.className).not.toContain('opacity-50')
    })

    it('past cancelled appointment block is not affected by past style', async () => {
      server.use(
        http.get(`/api/tenants/${TENANT_ID}/bookings`, () =>
          HttpResponse.json([PAST_CANCELLED]),
        ),
      )
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => screen.getByTestId('booking-block-bk-past-cancelled'))
      const block = screen.getByTestId('booking-block-bk-past-cancelled')
      expect(block.className).not.toContain('opacity-50')
    })
  })

  // ─── Staff filter ────────────────────────────────────────────────────────

  describe('Staff filter', () => {
    it('staff filter dropdown renders in the toolbar', async () => {
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /staff/i })).toBeInTheDocument()
      })
    })

    it('selecting a staff member updates URL with staffId', async () => {
      const user = userEvent.setup()
      renderAppointments('view=week&date=2026-05-04')
      await waitFor(() => screen.getByRole('combobox', { name: /staff/i }))
      await user.click(screen.getByRole('combobox', { name: /staff/i }))
      await waitFor(() => screen.getByRole('option', { name: /alice smith/i }))
      await user.click(screen.getByRole('option', { name: /alice smith/i }))
      expect(mockReplace).toHaveBeenLastCalledWith(expect.stringContaining('staffId=staff-1'), { scroll: false })
    })

    it('selecting All staff removes staffId from URL', async () => {
      const user = userEvent.setup()
      renderAppointments('view=week&date=2026-05-04&staffId=staff-1')
      await waitFor(() => screen.getByRole('combobox', { name: /staff/i }))
      await user.click(screen.getByRole('combobox', { name: /staff/i }))
      await waitFor(() => screen.getByRole('option', { name: /all staff/i }))
      await user.click(screen.getByRole('option', { name: /all staff/i }))
      expect(mockReplace).toHaveBeenLastCalledWith(
        expect.not.stringContaining('staffId'),
        { scroll: false },
      )
    })

    it('with staffId param, only bookings for that staff member are shown in week view', async () => {
      const staffBookings = [
        { ...BOOKINGS[0], id: 'bk-s1', staffId: 'staff-1', staffName: 'Alice Smith', clientName: 'Filtered Client' },
        { ...BOOKINGS[1], id: 'bk-s2', staffId: 'staff-2', staffName: 'Bob Jones', clientName: 'Other Client' },
      ]
      server.use(
        http.get(`/api/tenants/${TENANT_ID}/bookings`, () =>
          HttpResponse.json(staffBookings),
        ),
      )
      renderAppointments('view=week&date=2026-05-04&staffId=staff-1')
      await waitFor(() => screen.getByTestId('booking-block-bk-s1'))
      expect(screen.queryByTestId('booking-block-bk-s2')).not.toBeInTheDocument()
    })
  })
})
