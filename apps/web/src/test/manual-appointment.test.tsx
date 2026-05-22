import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useSearchParams } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserProvider } from '@/components/UserProvider'
import { http, HttpResponse } from 'msw'
import { server } from './handlers'
import { AppointmentsPage } from '@/page-components/appointments/AppointmentsPage'
import { TEST_TOKEN, TENANT_ID, SLOTS, LOCATIONS, SERVICE_STAFF } from './handlers'

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

const FIXED_NOW = new Date('2026-05-04T10:00:00.000Z')
const BASE = '/api'

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

describe('Manual appointment entry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('panel opens via toolbar "New appointment" button', async () => {
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    expect(screen.getByTestId('new-appointment-panel')).toBeInTheDocument()
  })

  it('panel closes when backdrop is clicked', async () => {
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    expect(screen.getByTestId('new-appointment-panel')).toBeInTheDocument()
    // The backdrop div is directly behind the panel; click it
    const backdrop = screen.getByTestId('new-appointment-panel').previousSibling as HTMLElement
    fireEvent.click(backdrop)
    expect(screen.queryByTestId('new-appointment-panel')).not.toBeInTheDocument()
  })

  it('slot grid renders available and taken states', async () => {
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    await waitFor(() => expect(screen.getAllByTestId('slot-available').length).toBeGreaterThan(0))
    expect(screen.getAllByTestId('slot-taken').length).toBeGreaterThan(0)
  })

  it('conflict warning appears when taken slot is selected', async () => {
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    await waitFor(() => expect(screen.getAllByTestId('slot-taken').length).toBeGreaterThan(0))
    const takenBtn = screen.getAllByTestId('slot-taken')[0]
    await userEvent.click(takenBtn)
    expect(screen.getByTestId('conflict-warning')).toBeInTheDocument()
  })

  it('form submit triggers query invalidation and closes panel', async () => {
    let postCalled = false
    server.use(
      http.post(`${BASE}/tenants/${TENANT_ID}/bookings`, async ({ request }) => {
        postCalled = true
        const body = await request.json() as Record<string, unknown>
        return HttpResponse.json(
          {
            id: 'bk-new',
            tenantId: TENANT_ID,
            serviceId: body.serviceId,
            clientName: body.clientName,
            clientPhone: body.clientPhone,
            clientEmail: null,
            startAt: body.startAt,
            endAt: body.endAt,
            status: 'pending',
            notes: null,
            createdAt: new Date().toISOString(),
          },
          { status: 201 },
        )
      }),
    )

    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)

    // Fill in required fields
    await userEvent.type(screen.getByLabelText('Name'), 'Test Client')
    await userEvent.type(screen.getByLabelText('Phone'), '+1 555 123 4567')

    // Select an available slot
    await waitFor(() => expect(screen.getAllByTestId('slot-available').length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByTestId('slot-available')[0])

    await userEvent.click(screen.getByTestId('submit-booking'))

    await waitFor(() => expect(postCalled).toBe(true))
    await waitFor(() => expect(screen.queryByTestId('new-appointment-panel')).not.toBeInTheDocument())
  })

  it('shows validation error when name is missing', async () => {
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    // Only fill phone, not name
    await userEvent.type(screen.getByLabelText('Phone'), '+1 555 000 0000')
    await userEvent.click(screen.getByTestId('submit-booking'))
    expect(screen.getByTestId('panel-error')).toHaveTextContent('name')
  })

  it('shows validation error when phone is too short', async () => {
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    await userEvent.type(screen.getByLabelText('Name'), 'Test Client')
    await userEvent.type(screen.getByLabelText('Phone'), '123')
    await userEvent.click(screen.getByTestId('submit-booking'))
    expect(screen.getByTestId('panel-error')).toHaveTextContent('Phone')
  })

  // ---------------------------------------------------------------------------
  // Location selector in NewAppointmentPanel
  // ---------------------------------------------------------------------------

  it('location selector is hidden for single-location tenant', async () => {
    // default LOCATIONS has 1 active location → hide selector
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    await waitFor(() => screen.getByTestId('new-appointment-panel'))
    expect(screen.queryByLabelText(/location/i)).not.toBeInTheDocument()
  })

  it('location selector is shown for multi-location tenant', async () => {
    server.use(
      http.get(`${BASE}/tenants/${TENANT_ID}/locations`, () =>
        HttpResponse.json([
          ...LOCATIONS.filter(l => l.isActive),
          { id: 'loc-3', tenantId: TENANT_ID, name: 'West Branch', address: null, timezone: 'UTC', isActive: true, createdAt: '2026-05-03T00:00:00.000Z' },
        ]),
      ),
    )
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
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
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    await waitFor(() => screen.getByLabelText(/name/i))
    await userEvent.type(screen.getByLabelText('Name'), 'Test Client')
    await userEvent.type(screen.getByLabelText('Phone'), '+1 555 123 4567')
    // No slot selection — slots don't load until location is picked
    await userEvent.click(screen.getByTestId('submit-booking'))
    await waitFor(() => {
      expect(screen.getByTestId('panel-error')).toHaveTextContent(/location/i)
    })
  })
})

describe('M6d — Staff selection', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('staff dropdown is visible when panel is open', async () => {
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    await waitFor(() => screen.getByTestId('new-appointment-panel'))
    expect(screen.getByTestId('staff-select')).toBeInTheDocument()
  })

  it('"Any available" is the first option in the staff dropdown', async () => {
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    await waitFor(() => screen.getByTestId('staff-select'))
    const staffSelect = screen.getByTestId('staff-select') as HTMLSelectElement
    expect(staffSelect.options[0].text).toMatch(/any available/i)
    expect(staffSelect.value).toBe('')
  })

  it('staff dropdown lists qualified staff from the service staff endpoint', async () => {
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    await waitFor(() => expect(screen.getByRole('option', { name: SERVICE_STAFF[0].name })).toBeInTheDocument())
  })

  it('shows no-staff note when service has no staff at location', async () => {
    server.use(
      http.get(`${BASE}/tenants/${TENANT_ID}/services/:serviceId/staff`, () =>
        HttpResponse.json([]),
      ),
    )
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    await waitFor(() => screen.getByTestId('new-appointment-panel'))
    await waitFor(() => expect(screen.getByTestId('no-staff-note')).toBeInTheDocument())
  })

  it('POST body includes null staffId when "Any available" is selected', async () => {
    let capturedBody: Record<string, unknown> | null = null
    server.use(
      http.post(`${BASE}/tenants/${TENANT_ID}/bookings`, async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>
        return HttpResponse.json(
          { id: 'bk-new', tenantId: TENANT_ID, serviceId: capturedBody.serviceId, locationId: 'loc-1',
            staffId: 'staff-1', staffName: 'Alice Smith', clientName: capturedBody.clientName,
            clientPhone: capturedBody.clientPhone, clientEmail: null, startAt: capturedBody.startAt,
            endAt: capturedBody.endAt, status: 'pending', notes: null, createdAt: new Date().toISOString() },
          { status: 201 },
        )
      }),
    )
    renderAppointments('view=week&date=2026-05-04')
    await userEvent.click(await screen.findByTestId('new-appointment-btn'))
    await userEvent.type(screen.getByLabelText('Name'), 'Test Client')
    await userEvent.type(screen.getByLabelText('Phone'), '+1 555 123 4567')
    await waitFor(() => expect(screen.getAllByTestId('slot-available').length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByTestId('slot-available')[0])
    await userEvent.click(screen.getByTestId('submit-booking'))
    await waitFor(() => expect(capturedBody).not.toBeNull())
    expect(capturedBody!.staffId).toBeNull()
  })

  it('POST body includes staffId UUID when specific staff is selected', async () => {
    let capturedBody: Record<string, unknown> | null = null
    server.use(
      http.post(`${BASE}/tenants/${TENANT_ID}/bookings`, async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>
        return HttpResponse.json(
          { id: 'bk-new', tenantId: TENANT_ID, serviceId: capturedBody.serviceId, locationId: 'loc-1',
            staffId: 'staff-1', staffName: 'Alice Smith', clientName: capturedBody.clientName,
            clientPhone: capturedBody.clientPhone, clientEmail: null, startAt: capturedBody.startAt,
            endAt: capturedBody.endAt, status: 'pending', notes: null, createdAt: new Date().toISOString() },
          { status: 201 },
        )
      }),
    )
    renderAppointments('view=week&date=2026-05-04')
    await userEvent.click(await screen.findByTestId('new-appointment-btn'))
    await waitFor(() => expect(screen.getByRole('option', { name: SERVICE_STAFF[0].name })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByTestId('staff-select'), SERVICE_STAFF[0].id)
    await userEvent.type(screen.getByLabelText('Name'), 'Test Client')
    await userEvent.type(screen.getByLabelText('Phone'), '+1 555 123 4567')
    await waitFor(() => expect(screen.getAllByTestId('slot-available').length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByTestId('slot-available')[0])
    await userEvent.click(screen.getByTestId('submit-booking'))
    await waitFor(() => expect(capturedBody).not.toBeNull())
    expect(capturedBody!.staffId).toBe(SERVICE_STAFF[0].id)
  })

  it('changing staff selection resets the selected slot', async () => {
    renderAppointments('view=week&date=2026-05-04')
    await userEvent.click(await screen.findByTestId('new-appointment-btn'))
    await userEvent.type(screen.getByLabelText('Name'), 'Test Client')
    await userEvent.type(screen.getByLabelText('Phone'), '+1 555 123 4567')
    await waitFor(() => expect(screen.getAllByTestId('slot-available').length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByTestId('slot-available')[0])
    // Select a specific staff member — slot should reset
    await waitFor(() => expect(screen.getByRole('option', { name: SERVICE_STAFF[0].name })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByTestId('staff-select'), SERVICE_STAFF[0].id)
    // Submit with no slot selected should show slot error
    await userEvent.click(screen.getByTestId('submit-booking'))
    await waitFor(() => expect(screen.getByTestId('panel-error')).toHaveTextContent(/slot/i))
  })

  it('slot grid fetches with staffId param when specific staff is selected', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/tenants/${TENANT_ID}/services/:serviceId/slots`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(SLOTS)
      }),
    )
    renderAppointments('view=week&date=2026-05-04')
    await userEvent.click(await screen.findByTestId('new-appointment-btn'))
    await waitFor(() => expect(screen.getByRole('option', { name: SERVICE_STAFF[0].name })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByTestId('staff-select'), SERVICE_STAFF[0].id)
    await waitFor(() => expect(capturedUrl).toContain(`staffId=${SERVICE_STAFF[0].id}`))
  })

  it('slot grid fetches with locationId (no staffId) when "Any available" is selected', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/tenants/${TENANT_ID}/services/:serviceId/slots`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(SLOTS)
      }),
    )
    renderAppointments('view=week&date=2026-05-04')
    await userEvent.click(await screen.findByTestId('new-appointment-btn'))
    await waitFor(() => {
      expect(capturedUrl).toContain('locationId=')
      expect(capturedUrl).not.toContain('staffId=')
    })
  })
})
