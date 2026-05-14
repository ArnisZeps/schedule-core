import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../../providers/AuthProvider'
import DashboardLayout from '../../app/(dashboard)/layout'
import { useAuth } from '@/hooks/useAuth'
import { useStaff } from '@/hooks/useStaff'
import { TEST_TOKEN } from './handlers'

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

let mockReplace: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockReplace = vi.fn()
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), replace: mockReplace, back: vi.fn() } as any)
})

// Simulates a page that uses useStaff — the hook that crashes if user is null
function StaffPageContent() {
  useStaff('staff-1')
  return <div>Staff Detail</div>
}

// Direct logout trigger — avoids Radix dropdown complexity in jsdom
function LogoutTrigger() {
  const { logout } = useAuth()
  return <button onClick={logout}>Sign out</button>
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <DashboardLayout>
          <StaffPageContent />
          <LogoutTrigger />
        </DashboardLayout>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('Logout', () => {
  beforeEach(() => localStorage.clear())

  it('navigates to /login without throwing when logout is triggered from a dashboard page', async () => {
    localStorage.setItem('sc_token', TEST_TOKEN)
    renderDashboard()

    // Wait for dashboard content — hooks are mounted and running with a valid user
    await waitFor(() => {
      expect(screen.getByText('Staff Detail')).toBeInTheDocument()
    })

    // Trigger logout
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    // Should redirect without crashing
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login')
    })

    // Children must be unmounted after logout
    expect(screen.queryByText('Staff Detail')).not.toBeInTheDocument()
  })

  it('renders nothing and redirects to /login when there is no valid token', async () => {
    renderDashboard()

    // Children must never mount
    expect(screen.queryByText('Staff Detail')).not.toBeInTheDocument()

    // Must redirect to /login
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login')
    })
  })
})
