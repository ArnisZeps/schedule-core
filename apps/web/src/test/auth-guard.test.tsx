import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../../providers/AuthProvider'
import DashboardLayout from '../../app/(dashboard)/layout'
import { ServiceListPage } from '@/page-components/services/ServiceListPage'
import { TEST_TOKEN } from './handlers'

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

let mockPush: ReturnType<typeof vi.fn>
let mockReplace: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockPush = vi.fn()
  mockReplace = vi.fn()
  vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: mockReplace, back: vi.fn() } as any)
})

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <DashboardLayout>
          <ServiceListPage />
        </DashboardLayout>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('Auth guard', () => {
  beforeEach(() => localStorage.clear())

  it('redirects unauthenticated user from /services to /login', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login')
    })
  })

  it('allows authenticated user to access /services', async () => {
    localStorage.setItem('sc_token', TEST_TOKEN)
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/meeting room a/i)).toBeInTheDocument()
    })
  })
})
