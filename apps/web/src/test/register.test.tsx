import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../../providers/AuthProvider'
import { server, TEST_TOKEN } from './handlers'
import { http, HttpResponse } from 'msw'
import { RegisterPage } from '@/page-components/RegisterPage'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => '/register'),
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

function renderRegister() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider><RegisterPage /></AuthProvider>
    </QueryClientProvider>,
  )
}

describe('Register page', () => {
  beforeEach(() => localStorage.clear())

  it('renders all four fields', () => {
    renderRegister()
    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/slug/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('slug auto-derives from business name', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByLabelText(/business name/i), 'Acme Barber Shop!')
    expect(screen.getByLabelText(/slug/i)).toHaveValue('acme-barber-shop')
  })

  it('manual slug edit stops auto-derivation on subsequent business name changes', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.type(screen.getByLabelText(/business name/i), 'First Name')
    await user.clear(screen.getByLabelText(/slug/i))
    await user.type(screen.getByLabelText(/slug/i), 'my-custom-slug')
    await user.type(screen.getByLabelText(/business name/i), ' Extra')
    expect(screen.getByLabelText(/slug/i)).toHaveValue('my-custom-slug')
  })

  it('happy path: submits and redirects to /services', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText(/business name/i), 'Test Biz')
    await user.type(screen.getByLabelText(/email/i), 'owner@test.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/services')
    })
  })

  it('disables submit button and shows "Creating account…" while in-flight', async () => {
    let resolveSignup!: () => void
    const signupPaused = new Promise<void>(r => { resolveSignup = r })

    server.use(
      http.post('/api/auth/signup', async () => {
        await signupPaused
        return HttpResponse.json({ token: TEST_TOKEN }, { status: 201 })
      }),
    )

    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText(/business name/i), 'Test Biz')
    await user.type(screen.getByLabelText(/email/i), 'owner@test.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')

    const clickPromise = user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled()
    })

    resolveSignup()
    await clickPromise
  })

  it('shows "Email already registered" on email field for email_taken', async () => {
    server.use(
      http.post('/api/auth/signup', () =>
        HttpResponse.json({ error: 'email_taken' }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText(/business name/i), 'Test Biz')
    await user.type(screen.getByLabelText(/email/i), 'taken@test.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument()
    })
  })

  it('shows "This URL is already taken" on slug field for slug_taken', async () => {
    server.use(
      http.post('/api/auth/signup', () =>
        HttpResponse.json({ error: 'slug_taken' }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText(/business name/i), 'Test Biz')
    await user.type(screen.getByLabelText(/email/i), 'owner@test.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/this url is already taken/i)).toBeInTheDocument()
    })
  })

  it('shows "This URL is reserved" on slug field for slug_reserved', async () => {
    server.use(
      http.post('/api/auth/signup', () =>
        HttpResponse.json({ error: 'validation_error', details: ['slug_reserved'] }, { status: 422 }),
      ),
    )
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText(/business name/i), 'API Services')
    await user.clear(screen.getByLabelText(/slug/i))
    await user.type(screen.getByLabelText(/slug/i), 'api')
    await user.type(screen.getByLabelText(/email/i), 'owner@test.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText(/this url is reserved/i)).toBeInTheDocument()
    })
  })

  it('redirects authenticated user to /services', async () => {
    localStorage.setItem('sc_token', TEST_TOKEN)
    renderRegister()

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/services')
    })
  })

  it('has a link to /login', () => {
    renderRegister()
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login')
  })
})
