import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useSearchParams } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserProvider } from '@/components/UserProvider'
import { http, HttpResponse } from 'msw'
import { server } from './handlers'
import { AppointmentsPage } from '@/page-components/appointments/AppointmentsPage'
import type { ServiceStaffEntry } from '@/page-components/appointments/AppointmentsPage'
import { TENANT_ID, SERVICES, SERVICE_STAFF, LOCATIONS } from './handlers'

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

const BASE = '/api'
const FIXED_NOW = new Date('2026-05-04T10:00:00.000Z')

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), replace: vi.fn(), back: vi.fn() } as any)
})

function renderWithSSR(initialServiceStaff: ServiceStaffEntry[], search = 'view=week&date=2026-05-04') {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(search) as any)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <UserProvider user={{ userId: 'user-1', tenantId: TENANT_ID }}>
        <AppointmentsPage initialServiceStaff={initialServiceStaff} />
      </UserProvider>
    </QueryClientProvider>,
  )
  return client
}

describe('staff-preload — cache seeding from initialServiceStaff', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('staff appears immediately from seeded cache when network is blocked', async () => {
    // Block the service-staff endpoint — proves staff must come from the seeded cache, not the network
    server.use(
      http.get(`${BASE}/tenants/${TENANT_ID}/services/:serviceId/staff`, () =>
        new Promise<never>(() => {}),
      ),
    )

    renderWithSSR([
      { serviceId: SERVICES[0].id, locationId: LOCATIONS[0].id, staff: [SERVICE_STAFF[0]] },
    ])

    await userEvent.click(await screen.findByTestId('new-appointment-btn'))

    await waitFor(() =>
      expect(screen.getByRole('option', { name: SERVICE_STAFF[0].name })).toBeInTheDocument(),
    )
  })

  it('empty initialServiceStaff does not crash; staff loads from network as normal', async () => {
    renderWithSSR([])

    await userEvent.click(await screen.findByTestId('new-appointment-btn'))

    await waitFor(() =>
      expect(screen.getByRole('option', { name: SERVICE_STAFF[0].name })).toBeInTheDocument(),
    )
  })

  it('multi-location: seeds correct staff per (serviceId, locationId) pair', async () => {
    const staffLoc3: (typeof SERVICE_STAFF)[0] = {
      id: 'staff-loc3',
      tenantId: TENANT_ID,
      name: 'West Branch Staff',
      email: null,
      phone: null,
      isActive: true,
      locationId: 'loc-3',
      createdAt: '2026-05-01T00:00:00.000Z',
    }

    server.use(
      http.get(`${BASE}/tenants/${TENANT_ID}/locations`, () =>
        HttpResponse.json([
          LOCATIONS[0],
          { id: 'loc-3', tenantId: TENANT_ID, name: 'West Branch', address: null, timezone: 'UTC', isActive: true, createdAt: '2026-05-03T00:00:00.000Z' },
        ]),
      ),
      // Block network so staff must come from cache
      http.get(`${BASE}/tenants/${TENANT_ID}/services/:serviceId/staff`, () =>
        new Promise<never>(() => {}),
      ),
    )

    renderWithSSR([
      { serviceId: SERVICES[0].id, locationId: LOCATIONS[0].id, staff: [SERVICE_STAFF[0]] },
      { serviceId: SERVICES[0].id, locationId: 'loc-3', staff: [staffLoc3] },
    ])

    await userEvent.click(await screen.findByTestId('new-appointment-btn'))

    // Select loc-1 — should show SERVICE_STAFF[0]
    const locationSelect = await screen.findByLabelText(/location/i)
    await userEvent.selectOptions(locationSelect, LOCATIONS[0].id)
    await waitFor(() =>
      expect(screen.getByRole('option', { name: SERVICE_STAFF[0].name })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('option', { name: staffLoc3.name })).not.toBeInTheDocument()

    // Switch to loc-3 — should show staffLoc3
    await userEvent.selectOptions(screen.getByLabelText(/location/i), 'loc-3')
    await waitFor(() =>
      expect(screen.getByRole('option', { name: staffLoc3.name })).toBeInTheDocument(),
    )
    expect(screen.queryByRole('option', { name: SERVICE_STAFF[0].name })).not.toBeInTheDocument()
  })
})
