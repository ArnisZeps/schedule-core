// Phase 2 SSR: each dashboard page passes server-fetched data via dehydrate/HydrationBoundary.
// These tests verify the page components render immediately without waiting for a network response
// (synchronous first-render assertion, no waitFor). HydrationBoundary seeds the React Query
// cache before children mount, so useQuery returns data on the very first render.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { QueryClient, QueryClientProvider, dehydrate } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from './handlers'
import { UserProvider } from '@/components/UserProvider'
import { ServiceListPage } from '@/page-components/services/ServiceListPage'
import { LocationListPage } from '@/page-components/locations/LocationListPage'
import { StaffListPage } from '@/page-components/staff/StaffListPage'
import { AppointmentsPage } from '@/page-components/appointments/AppointmentsPage'
import { SERVICES, LOCATIONS, STAFF, BOOKINGS } from './handlers'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => '/services'),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={String(href)} {...props as object}>{children}</a>,
}))

const TEST_USER = { userId: 'user-1', tenantId: 'tenant-1' }

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), replace: vi.fn(), back: vi.fn() } as any)
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('view=week&from=2026-05-04&to=2026-05-11') as any)

  // Hang all data-fetching APIs so synchronous assertions come only from HydrationBoundary
  server.use(
    http.get('/api/tenants/:tenantId/services', () => new HttpResponse(null, { status: 200, headers: { 'Content-Type': 'application/json' }, body: new ReadableStream() }) as never),
    http.get('/api/tenants/:tenantId/locations', () => new HttpResponse(null, { status: 200, headers: { 'Content-Type': 'application/json' }, body: new ReadableStream() }) as never),
    http.get('/api/tenants/:tenantId/staff', () => new HttpResponse(null, { status: 200, headers: { 'Content-Type': 'application/json' }, body: new ReadableStream() }) as never),
    http.get('/api/tenants/:tenantId/bookings', () => new HttpResponse(null, { status: 200, headers: { 'Content-Type': 'application/json' }, body: new ReadableStream() }) as never),
  )
})

function makeDehydratedState(setup: (qc: QueryClient) => void): unknown {
  const qc = new QueryClient()
  setup(qc)
  return dehydrate(qc)
}

function renderPage(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <UserProvider user={TEST_USER}>{ui}</UserProvider>
    </QueryClientProvider>
  )
}

describe('SSR initial data — synchronous first render via HydrationBoundary', () => {
  it('ServiceListPage renders from HydrationBoundary without waiting for network', () => {
    const dehydratedState = makeDehydratedState(qc =>
      qc.setQueryData(['services', TEST_USER.tenantId], SERVICES)
    )
    renderPage(<ServiceListPage dehydratedState={dehydratedState} />)
    expect(screen.getByText('Meeting Room A')).toBeInTheDocument()
  })

  it('LocationListPage renders from HydrationBoundary without waiting for network', () => {
    const dehydratedState = makeDehydratedState(qc =>
      qc.setQueryData(['locations', TEST_USER.tenantId, { includeInactive: false }], LOCATIONS.filter(l => l.isActive))
    )
    renderPage(<LocationListPage dehydratedState={dehydratedState} />)
    expect(screen.getByText('Main Branch')).toBeInTheDocument()
  })

  it('StaffListPage renders from HydrationBoundary without waiting for network', () => {
    const dehydratedState = makeDehydratedState(qc =>
      qc.setQueryData(['staff', TEST_USER.tenantId, { includeInactive: false, locationId: undefined }], STAFF.filter(s => s.isActive))
    )
    renderPage(<StaffListPage dehydratedState={dehydratedState} />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('AppointmentsPage renders WeekView immediately with hydrated bookings (no loading skeleton)', () => {
    const tenantId = TEST_USER.tenantId
    const dehydratedState = makeDehydratedState(qc => {
      qc.setQueryData(['bookings', tenantId, { from: '2026-05-04T00:00:00.000Z', to: '2026-05-11T00:00:00.000Z', serviceId: undefined }], BOOKINGS)
      qc.setQueryData(['services', tenantId], SERVICES)
      qc.setQueryData(['staff', tenantId, { includeInactive: false, locationId: undefined }], STAFF)
      qc.setQueryData(['locations', tenantId, { includeInactive: true }], LOCATIONS)
    })
    renderPage(<AppointmentsPage dehydratedState={dehydratedState} />)
    // WeekView headers only render when bookingsLoading=false; HydrationBoundary makes that true on first render
    expect(screen.getByText(/Mon.*4/i)).toBeInTheDocument()
  })
})
