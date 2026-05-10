import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useParams } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../../providers/AuthProvider'
import { server } from './handlers'
import { http, HttpResponse } from 'msw'
import { StaffListPage } from '@/page-components/staff/StaffListPage'
import { StaffCreatePage } from '@/page-components/staff/StaffCreatePage'
import { StaffDetailPage } from '@/page-components/staff/StaffDetailPage'
import { TEST_TOKEN, TENANT_ID, STAFF, STAFF_OVERRIDES, LOCATIONS } from './handlers'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => '/staff'),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={String(href)} {...props as object}>{children}</a>,
}))

const BASE = '/api'
// July 1 2026 is a Wednesday — override data (ov-1: Jul 1, ov-2: Jul 4-6) is in this week
const FIXED_TODAY = new Date('2026-07-01T10:00:00.000Z')

let mockPush: ReturnType<typeof vi.fn>
let mockReplace: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockPush = vi.fn()
  mockReplace = vi.fn()
  vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: mockReplace, back: vi.fn() } as any)
  vi.mocked(useParams).mockReturnValue({})
})

function renderPage(component: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>{component}</AuthProvider>
    </QueryClientProvider>,
  )
}

describe('Staff', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('sc_token', TEST_TOKEN)
  })

  // ---------------------------------------------------------------------------
  // Staff list
  // ---------------------------------------------------------------------------

  describe('Staff list', () => {
    it('renders active staff members', async () => {
      renderPage(<StaffListPage />)
      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument()
        expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()
      })
    })

    it('show-inactive toggle reveals deactivated staff', async () => {
      const user = userEvent.setup()
      renderPage(<StaffListPage />)
      await waitFor(() => screen.getByText('Alice Smith'))
      await user.click(screen.getByRole('checkbox', { name: /show inactive/i }))
      await waitFor(() => {
        expect(screen.getByText('Bob Jones')).toBeInTheDocument()
      })
    })

    it('add staff button is present', async () => {
      renderPage(<StaffListPage />)
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /add staff/i })).toBeInTheDocument()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Staff create form
  // ---------------------------------------------------------------------------

  describe('Staff create form', () => {
    it('name required validation prevents submit', async () => {
      const user = userEvent.setup()
      renderPage(<StaffCreatePage />)
      await waitFor(() => screen.getByLabelText(/name/i))
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument()
      })
    })

    it('invalid email format shows validation error', async () => {
      const user = userEvent.setup()
      renderPage(<StaffCreatePage />)
      await waitFor(() => screen.getByLabelText(/name/i))
      await user.type(screen.getByLabelText(/name/i), 'Test Staff')
      await user.type(screen.getByLabelText(/email/i), 'not-an-email')
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
      })
    })

    it('valid submit navigates to the new staff detail page', async () => {
      const user = userEvent.setup()
      renderPage(<StaffCreatePage />)
      await waitFor(() => screen.getByLabelText(/name/i))
      await user.type(screen.getByLabelText(/name/i), 'New Staff')
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(mockPush.mock.calls[0]?.[0]).toMatch(/^\/staff\//)
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Staff detail — profile
  // ---------------------------------------------------------------------------

  describe('Staff detail — profile', () => {
    beforeEach(() => {
      vi.mocked(useParams).mockReturnValue({ staffId: 'staff-1' })
    })

    it('deactivate button opens confirmation dialog', async () => {
      const user = userEvent.setup()
      renderPage(<StaffDetailPage />)
      await waitFor(() => screen.getByText('Alice Smith'))
      await user.click(screen.getByRole('button', { name: /deactivate/i }))
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })
    })

    it('confirming deactivation sends PATCH { isActive: false }', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.patch(`${BASE}/tenants/${TENANT_ID}/staff/staff-1`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ ...STAFF[0], isActive: false })
        }),
      )
      renderPage(<StaffDetailPage />)
      await waitFor(() => screen.getByText('Alice Smith'))
      await user.click(screen.getByRole('button', { name: /deactivate/i }))
      await waitFor(() => screen.getByRole('alertdialog'))
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /confirm/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({ isActive: false })
      })
    })

    it('reactivate button sends PATCH { isActive: true } for inactive staff', async () => {
      const user = userEvent.setup()
      vi.mocked(useParams).mockReturnValue({ staffId: 'staff-2' })
      let capturedBody: unknown
      server.use(
        http.patch(`${BASE}/tenants/${TENANT_ID}/staff/staff-2`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ ...STAFF[1], isActive: true })
        }),
      )
      renderPage(<StaffDetailPage />)
      await waitFor(() => screen.getByText('Bob Jones'))
      await user.click(screen.getByRole('button', { name: /reactivate/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({ isActive: true })
      })
    })

    it('delete staff member triggers DELETE request and navigates to list', async () => {
      const user = userEvent.setup()
      let deleteCalled = false
      server.use(
        http.delete(`${BASE}/tenants/${TENANT_ID}/staff/staff-1`, () => {
          deleteCalled = true
          return new HttpResponse(null, { status: 204 })
        }),
      )
      renderPage(<StaffDetailPage />)
      await waitFor(() => screen.getByText('Alice Smith'))
      await user.click(screen.getByRole('button', { name: /delete staff member/i }))
      await waitFor(() => screen.getByRole('alertdialog'))
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /confirm/i }))
      await waitFor(() => {
        expect(deleteCalled).toBe(true)
        expect(mockPush).toHaveBeenCalledWith('/staff')
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Service assignment
  // ---------------------------------------------------------------------------

  describe('Service assignment', () => {
    beforeEach(() => {
      vi.mocked(useParams).mockReturnValue({ staffId: 'staff-1' })
    })

    it('checkboxes reflect assigned services', async () => {
      renderPage(<StaffDetailPage />)
      await waitFor(() => {
        // handler returns [SERVICES[0]] for GET /staff/:staffId/services
        expect(screen.getByRole('checkbox', { name: /meeting room a/i })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: /staff: alice/i })).not.toBeChecked()
      })
    })

    it('save triggers PUT with all checked service IDs', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.put(`${BASE}/tenants/${TENANT_ID}/staff/staff-1/services`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json([])
        }),
      )
      renderPage(<StaffDetailPage />)
      await waitFor(() => screen.getByRole('checkbox', { name: /meeting room a/i }))
      await user.click(screen.getByRole('checkbox', { name: /staff: alice/i }))
      await user.click(screen.getByRole('button', { name: /save services/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({
          serviceIds: expect.arrayContaining(['res-1', 'res-2']),
        })
      })
    })

    it('unchecking all and saving sends empty serviceIds array', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.put(`${BASE}/tenants/${TENANT_ID}/staff/staff-1/services`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json([])
        }),
      )
      renderPage(<StaffDetailPage />)
      await waitFor(() => screen.getByRole('checkbox', { name: /meeting room a/i }))
      await user.click(screen.getByRole('checkbox', { name: /meeting room a/i }))
      await user.click(screen.getByRole('button', { name: /save services/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({ serviceIds: [] })
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Weekly schedule calendar
  // ---------------------------------------------------------------------------

  describe('Weekly schedule calendar', () => {
    beforeEach(() => {
      vi.mocked(useParams).mockReturnValue({ staffId: 'staff-1' })
    })

    it('renders existing schedule windows', async () => {
      renderPage(<StaffDetailPage />)
      // sched-1: dayOfWeek=1 (Monday), 09:00–17:00
      const block = await screen.findByTestId('schedule-block')
      expect(within(block).getByText('09:00')).toBeInTheDocument()
      expect(within(block).getByText('17:00')).toBeInTheDocument()
    })

    it('drag on a weekday column opens the schedule window panel', async () => {
      renderPage(<StaffDetailPage />)
      const col = await screen.findByTestId('weekday-col-2')
      fireEvent.mouseDown(col, { clientY: 576 })
      fireEvent.mouseMove(document, { clientY: 640 })
      fireEvent.mouseUp(document, { clientY: 640 })
      await waitFor(() => {
        expect(screen.getByTestId('schedule-window-panel')).toBeInTheDocument()
      })
    })

    it('clicking a schedule block opens the schedule window panel', async () => {
      const user = userEvent.setup()
      renderPage(<StaffDetailPage />)
      const block = await screen.findByTestId('schedule-block')
      await user.click(block)
      await waitFor(() => {
        expect(screen.getByTestId('schedule-window-panel')).toBeInTheDocument()
      })
    })

    it('creating from panel adds a block and saves to API', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.put(`${BASE}/tenants/${TENANT_ID}/staff/staff-1/schedules`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json([])
        }),
      )
      renderPage(<StaffDetailPage />)
      const col = await screen.findByTestId('weekday-col-2')
      fireEvent.mouseDown(col, { clientY: 576 })
      fireEvent.mouseMove(document, { clientY: 640 })
      fireEvent.mouseUp(document, { clientY: 640 })
      await waitFor(() => screen.getByTestId('schedule-window-panel'))
      await user.click(
        within(screen.getByTestId('schedule-window-panel')).getByRole('button', { name: /create schedule/i }),
      )
      await waitFor(() => {
        expect(capturedBody).toMatchObject({
          windows: expect.arrayContaining([
            expect.objectContaining({ dayOfWeek: 2 }),
          ]),
        })
      })
    })

    it('deleting from schedule panel removes the block and saves to API', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.put(`${BASE}/tenants/${TENANT_ID}/staff/staff-1/schedules`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json([])
        }),
      )
      renderPage(<StaffDetailPage />)
      const block = await screen.findByTestId('schedule-block')
      await user.click(block)
      await waitFor(() => screen.getByTestId('schedule-window-panel'))
      await user.click(
        within(screen.getByTestId('schedule-window-panel')).getByRole('button', { name: /delete/i }),
      )
      await waitFor(() => {
        expect(screen.queryByTestId('schedule-block')).not.toBeInTheDocument()
        expect(capturedBody).toMatchObject({ windows: [] })
      })
    })

    it('save schedule sends PUT with windows payload (compat check)', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.put(`${BASE}/tenants/${TENANT_ID}/staff/staff-1/schedules`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json([])
        }),
      )
      renderPage(<StaffDetailPage />)
      // open existing block panel and update it to trigger auto-save
      const block = await screen.findByTestId('schedule-block')
      await user.click(block)
      await waitFor(() => screen.getByTestId('schedule-window-panel'))
      await user.click(screen.getByRole('button', { name: /update/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({
          windows: expect.arrayContaining([
            expect.objectContaining({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }),
          ]),
        })
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Override calendar
  // ---------------------------------------------------------------------------

  describe('Override calendar', () => {
    beforeEach(() => {
      vi.mocked(useParams).mockReturnValue({ staffId: 'staff-1' })
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(FIXED_TODAY)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('renders green block for available override', async () => {
      renderPage(<StaffDetailPage />)
      await waitFor(() => {
        const block = screen.getByTestId('override-block-ov-1')
        expect(block).toBeInTheDocument()
        expect(block).toHaveAttribute('data-override-type', 'available')
      })
    })

    it('renders red block for not_available override', async () => {
      renderPage(<StaffDetailPage />)
      await waitFor(() => {
        const block = screen.getByTestId(`override-block-${STAFF_OVERRIDES[1].id}`)
        expect(block).toBeInTheDocument()
        expect(block).toHaveAttribute('data-override-type', 'not_available')
      })
    })

    it('create override button opens blank panel', async () => {
      const user = userEvent.setup()
      renderPage(<StaffDetailPage />)
      await waitFor(() => screen.getByRole('button', { name: /create override/i }))
      await user.click(screen.getByRole('button', { name: /create override/i }))
      await waitFor(() => {
        expect(screen.getByTestId('override-panel')).toBeInTheDocument()
        expect((screen.getByLabelText(/start date/i) as HTMLInputElement).value).toBe('')
      })
    })

    it('clicking an override block opens panel in edit mode', async () => {
      const user = userEvent.setup()
      renderPage(<StaffDetailPage />)
      const block = await screen.findByTestId('override-block-ov-1')
      await user.click(block)
      await waitFor(() => {
        expect(screen.getByTestId('override-panel')).toBeInTheDocument()
        expect((screen.getByLabelText(/start date/i) as HTMLInputElement).value).toBe('2026-07-01')
      })
    })

    it('drag on override calendar column opens panel with pre-filled date and start time', async () => {
      renderPage(<StaffDetailPage />)
      // Thu July 2 — col testid uses ISO date; no existing override on this day
      const col = await screen.findByTestId('override-col-2026-07-03') // Friday
      // HOUR_PX=64, TOTAL_HEIGHT=1536: clientY=576 → 09:00
      fireEvent.mouseDown(col, { clientY: 576 })
      fireEvent.mouseMove(document, { clientY: 640 })
      fireEvent.mouseUp(document, { clientY: 640 })
      await waitFor(() => {
        expect(screen.getByTestId('override-panel')).toBeInTheDocument()
        expect((screen.getByLabelText(/start date/i) as HTMLInputElement).value).toBe('2026-07-03')
        expect((screen.getByLabelText(/start time/i) as HTMLInputElement).value).toBe('09:00')
      })
    })

    it('delete from panel triggers DELETE request and closes panel', async () => {
      const user = userEvent.setup()
      let deleteCalled = false
      server.use(
        http.delete(`${BASE}/tenants/${TENANT_ID}/staff/staff-1/overrides/ov-1`, () => {
          deleteCalled = true
          return new HttpResponse(null, { status: 204 })
        }),
      )
      renderPage(<StaffDetailPage />)
      const block = await screen.findByTestId('override-block-ov-1')
      await user.click(block)
      await waitFor(() => screen.getByTestId('override-panel'))
      await user.click(
        within(screen.getByTestId('override-panel')).getByRole('button', { name: /delete/i }),
      )
      await waitFor(() => {
        expect(deleteCalled).toBe(true)
        expect(screen.queryByTestId('override-panel')).not.toBeInTheDocument()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Staff location — create form (single-location tenant)
  // ---------------------------------------------------------------------------

  describe('Staff create form — location', () => {
    it('location dropdown is hidden for single-location tenant and value is auto-applied', async () => {
      // default LOCATIONS has 1 active location → single-location → hide dropdown
      renderPage(<StaffCreatePage />)
      await waitFor(() => screen.getByLabelText(/name/i))
      // dropdown should be absent from DOM
      expect(screen.queryByLabelText(/location/i)).not.toBeInTheDocument()
    })

    it('location dropdown is shown for multi-location tenant', async () => {
      server.use(
        http.get(`${BASE}/tenants/${TENANT_ID}/locations`, () =>
          HttpResponse.json([
            ...LOCATIONS.filter(l => l.isActive),
            { id: 'loc-3', tenantId: TENANT_ID, name: 'West Branch', address: null, timezone: 'UTC', isActive: true, createdAt: '2026-05-03T00:00:00.000Z' },
          ]),
        ),
      )
      renderPage(<StaffCreatePage />)
      await waitFor(() => screen.getByLabelText(/location/i))
      expect(screen.getByLabelText(/location/i)).toBeInTheDocument()
    })

    it('submitting without location on multi-location tenant shows validation error', async () => {
      server.use(
        http.get(`${BASE}/tenants/${TENANT_ID}/locations`, () =>
          HttpResponse.json([
            ...LOCATIONS.filter(l => l.isActive),
            { id: 'loc-3', tenantId: TENANT_ID, name: 'West Branch', address: null, timezone: 'UTC', isActive: true, createdAt: '2026-05-03T00:00:00.000Z' },
          ]),
        ),
      )
      const user = userEvent.setup()
      renderPage(<StaffCreatePage />)
      await waitFor(() => screen.getByLabelText(/name/i))
      await user.type(screen.getByLabelText(/name/i), 'New Staff')
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(screen.getByText(/location is required/i)).toBeInTheDocument()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Staff list — location filter
  // ---------------------------------------------------------------------------

  describe('Staff list — location filter', () => {
    it('location filter is hidden for single-location tenant', async () => {
      // default LOCATIONS has 1 active location → single-location → hide filter
      renderPage(<StaffListPage />)
      await waitFor(() => screen.getByText('Alice Smith'))
      expect(screen.queryByLabelText(/filter by location/i)).not.toBeInTheDocument()
    })

    it('location filter is shown for multi-location tenant', async () => {
      server.use(
        http.get(`${BASE}/tenants/${TENANT_ID}/locations`, () =>
          HttpResponse.json([
            ...LOCATIONS.filter(l => l.isActive),
            { id: 'loc-3', tenantId: TENANT_ID, name: 'West Branch', address: null, timezone: 'UTC', isActive: true, createdAt: '2026-05-03T00:00:00.000Z' },
          ]),
        ),
      )
      renderPage(<StaffListPage />)
      await waitFor(() => screen.getByLabelText(/filter by location/i))
      expect(screen.getByLabelText(/filter by location/i)).toBeInTheDocument()
    })

    it('selecting a location re-fetches staff filtered by that location', async () => {
      server.use(
        http.get(`${BASE}/tenants/${TENANT_ID}/locations`, () =>
          HttpResponse.json([
            ...LOCATIONS.filter(l => l.isActive),
            { id: 'loc-3', tenantId: TENANT_ID, name: 'West Branch', address: null, timezone: 'UTC', isActive: true, createdAt: '2026-05-03T00:00:00.000Z' },
          ]),
        ),
      )
      let capturedLocationId: string | null = null
      server.use(
        http.get(`${BASE}/tenants/${TENANT_ID}/staff`, ({ request }) => {
          const url = new URL(request.url)
          capturedLocationId = url.searchParams.get('locationId')
          return HttpResponse.json(STAFF.filter(s => s.isActive))
        }),
      )
      const user = userEvent.setup()
      renderPage(<StaffListPage />)
      await waitFor(() => screen.getByLabelText(/filter by location/i))
      // select West Branch (loc-3)
      await user.selectOptions(screen.getByLabelText(/filter by location/i), 'loc-3')
      await waitFor(() => {
        expect(capturedLocationId).toBe('loc-3')
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Staff detail — location in profile section
  // ---------------------------------------------------------------------------

  describe('Staff detail — location', () => {
    beforeEach(() => {
      vi.mocked(useParams).mockReturnValue({ staffId: 'staff-1' })
    })

    it('shows location dropdown in profile section', async () => {
      renderPage(<StaffDetailPage />)
      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument()
        // profile section shows location
        expect(screen.getAllByLabelText(/location/i).length).toBeGreaterThan(0)
      })
    })
  })
})
