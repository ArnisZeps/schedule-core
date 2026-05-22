import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { UserProvider } from '@/components/UserProvider'
import { NewAppointmentPanel } from '@/components/calendar/NewAppointmentPanel'
import { server, SERVICES, LOCATIONS, TENANT_ID } from './handlers'
import type { Location } from '@/hooks/useLocations'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => '/appointments'),
}))

const TWO_ACTIVE_LOCATIONS: Location[] = [
  { id: 'loc-1', tenantId: TENANT_ID, name: 'Main Branch', address: '123 Main St', timezone: 'UTC', isActive: true, createdAt: '2026-05-01T00:00:00.000Z' },
  { id: 'loc-2', tenantId: TENANT_ID, name: 'East Branch', address: null, timezone: 'UTC', isActive: true, createdAt: '2026-05-02T00:00:00.000Z' },
]

const ONE_ACTIVE_LOCATION: Location[] = [
  { id: 'loc-1', tenantId: TENANT_ID, name: 'Main Branch', address: '123 Main St', timezone: 'UTC', isActive: true, createdAt: '2026-05-01T00:00:00.000Z' },
]

function renderPanel(locations: Location[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <UserProvider user={{ userId: 'user-1', tenantId: TENANT_ID }}>
        <NewAppointmentPanel
          services={SERVICES}
          locations={locations}
          onClose={vi.fn()}
        />
      </UserProvider>
    </QueryClientProvider>,
  )
}

describe('fix-location-dropdown-flash', () => {
  it('renders Location dropdown synchronously from locations prop with 2+ active locations', () => {
    renderPanel(TWO_ACTIVE_LOCATIONS)
    // Synchronous — no waitFor — must be present immediately on render
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument()
  })

  it('hides Location dropdown when only one active location is in the prop', () => {
    renderPanel(ONE_ACTIVE_LOCATION)
    expect(screen.queryByLabelText(/location/i)).not.toBeInTheDocument()
  })

  it('does not fire a locations network request when panel is rendered', async () => {
    let locationFetchCount = 0
    server.use(
      http.get(`/api/tenants/${TENANT_ID}/locations`, () => {
        locationFetchCount++
        return HttpResponse.json(LOCATIONS)
      }),
    )
    renderPanel(TWO_ACTIVE_LOCATIONS)
    await new Promise(r => setTimeout(r, 50))
    expect(locationFetchCount).toBe(0)
  })
})
