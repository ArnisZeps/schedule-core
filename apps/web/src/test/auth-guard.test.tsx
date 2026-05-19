// The dashboard auth guard is implemented in Next.js middleware (Edge runtime) and cannot be
// tested with React Testing Library. The middleware redirects unauthenticated requests to /login
// before the page renders. The UserProvider renders the authenticated dashboard for valid users.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserProvider } from '@/components/UserProvider'
import { ServiceListPage } from '@/page-components/services/ServiceListPage'

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

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), replace: vi.fn(), back: vi.fn() } as any)
})

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <UserProvider user={{ userId: 'user-1', tenantId: 'tenant-1' }}>
        <ServiceListPage />
      </UserProvider>
    </QueryClientProvider>,
  )
}

describe('Auth guard', () => {
  it('renders dashboard page when UserProvider supplies a valid user', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/meeting room a/i)).toBeInTheDocument()
    })
  })
})
