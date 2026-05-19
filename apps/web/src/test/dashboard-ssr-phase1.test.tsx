import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from './handlers'
import { http, HttpResponse } from 'msw'
import { UserProvider } from '@/components/UserProvider'
import { useAuth } from '@/hooks/useAuth'

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

let mockReplace: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockReplace = vi.fn()
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), replace: mockReplace, back: vi.fn() } as any)
})

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><UserProvider user={TEST_USER}>{ui}</UserProvider></QueryClientProvider>)
}

function AuthConsumer() {
  const { user } = useAuth()
  return <span data-testid="auth">{user?.userId}:{user?.tenantId}</span>
}

function LogoutButton() {
  const { logout } = useAuth()
  return <button onClick={logout}>Sign out</button>
}

describe('UserProvider', () => {
  it('exposes userId and tenantId to descendants via useAuth()', () => {
    wrap(<AuthConsumer />)
    expect(screen.getByTestId('auth')).toHaveTextContent('user-1:tenant-1')
  })

  it('renders children', () => {
    wrap(<div>dashboard content</div>)
    expect(screen.getByText('dashboard content')).toBeInTheDocument()
  })

  it('logout calls POST /api/auth/logout then redirects to /login', async () => {
    let logoutHit = false
    server.use(
      http.post('/api/auth/logout', () => {
        logoutHit = true
        return new HttpResponse(null, { status: 204 })
      }),
    )

    wrap(<LogoutButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(logoutHit).toBe(true)
    })
    expect(mockReplace).toHaveBeenCalledWith('/login')
  })
})
