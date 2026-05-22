import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from './handlers'
import { http, HttpResponse } from 'msw'
import { LoginPage } from '@/page-components/LoginPage'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => '/login'),
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

function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <LoginPage />
    </QueryClientProvider>,
  )
}

describe('Login page', () => {
  it('happy path: valid credentials redirect to /services', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email/i), 'owner@test.com')
    await user.type(screen.getByLabelText(/password/i), 'password')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/services')
    })
  })

  it('shows "Incorrect email or password." on 401 without page reload', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email/i), 'wrong@test.com')
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText('Incorrect email or password.')).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('shows "Login failed" on non-credential server error', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ error: 'server_error' }, { status: 500 }),
      ),
    )
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email/i), 'owner@test.com')
    await user.type(screen.getByLabelText(/password/i), 'password')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument()
    })
  })
})
