// Phase 2 SSR: each dashboard page passes server-fetched data as initialData to React Query.
// These tests verify the page components accept initial* props and render immediately
// without waiting for a network response (synchronous first-render assertion, no waitFor).

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('view=week&date=2026-05-04') as any)

  // Hang all data-fetching APIs so synchronous assertions come only from initialData
  server.use(
    http.get('/api/tenants/:tenantId/services', () => new HttpResponse(null, { status: 200, headers: { 'Content-Type': 'application/json' }, body: new ReadableStream() }) as never),
    http.get('/api/tenants/:tenantId/locations', () => new HttpResponse(null, { status: 200, headers: { 'Content-Type': 'application/json' }, body: new ReadableStream() }) as never),
    http.get('/api/tenants/:tenantId/staff', () => new HttpResponse(null, { status: 200, headers: { 'Content-Type': 'application/json' }, body: new ReadableStream() }) as never),
    http.get('/api/tenants/:tenantId/bookings', () => new HttpResponse(null, { status: 200, headers: { 'Content-Type': 'application/json' }, body: new ReadableStream() }) as never),
  )
})

function renderPage(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <UserProvider user={TEST_USER}>{ui}</UserProvider>
    </QueryClientProvider>
  )
}

describe('SSR initial data — synchronous first render', () => {
  it('ServiceListPage renders initialServices without waiting for network', () => {
    renderPage(<ServiceListPage initialServices={SERVICES} />)
    expect(screen.getByText('Meeting Room A')).toBeInTheDocument()
  })

  it('LocationListPage renders initialLocations without waiting for network', () => {
    renderPage(<LocationListPage initialLocations={LOCATIONS} />)
    expect(screen.getByText('Main Branch')).toBeInTheDocument()
  })

  it('StaffListPage renders initialStaff without waiting for network', () => {
    renderPage(<StaffListPage initialStaff={STAFF} />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('AppointmentsPage renders WeekView immediately with initialBookings (no loading skeleton)', () => {
    renderPage(
      <AppointmentsPage
        initialBookings={BOOKINGS}
        initialServices={SERVICES}
        initialStaff={STAFF}
        initialLocations={LOCATIONS}
      />
    )
    // WeekView headers only render when bookingsLoading=false; initialData makes that true on first render
    expect(screen.getByText(/Mon.*4/i)).toBeInTheDocument()
  })
})
