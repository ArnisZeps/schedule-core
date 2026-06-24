import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserProvider } from '@/components/UserProvider'
import { server } from './handlers'
import { http, HttpResponse } from 'msw'
import { SettingsPage } from '@/page-components/settings/SettingsPage'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => '/settings'),
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

const INITIAL = {
  email: 'owner@acme.test',
  tenant: { name: 'Acme Barber', slug: 'acme-barber' },
}

function renderSettings(props = INITIAL) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <UserProvider user={{ userId: 'user-1', tenantId: 'tenant-1' }}>
        <SettingsPage {...props} />
      </UserProvider>
    </QueryClientProvider>,
  )
}

describe('Settings page', () => {
  it('pre-fills current email, business name and slug', () => {
    renderSettings()
    expect((screen.getByLabelText(/^email$/i) as HTMLInputElement).value).toBe('owner@acme.test')
    expect((screen.getByLabelText(/business name/i) as HTMLInputElement).value).toBe('Acme Barber')
    expect((screen.getByLabelText(/^slug$/i) as HTMLInputElement).value).toBe('acme-barber')
  })

  it('updates the email and shows confirmation', async () => {
    const user = userEvent.setup()
    renderSettings()

    const email = screen.getByLabelText(/^email$/i)
    await user.clear(email)
    await user.type(email, 'new@acme.test')
    await user.click(screen.getByRole('button', { name: /save email/i }))

    await waitFor(() => {
      expect(screen.getByText(/email updated/i)).toBeInTheDocument()
    })
  })

  it('shows an error when the email is already in use', async () => {
    server.use(
      http.patch('/api/account/email', () =>
        HttpResponse.json({ error: 'email_taken' }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderSettings()

    const email = screen.getByLabelText(/^email$/i)
    await user.clear(email)
    await user.type(email, 'taken@acme.test')
    await user.click(screen.getByRole('button', { name: /save email/i }))

    await waitFor(() => {
      expect(screen.getByText(/email already in use/i)).toBeInTheDocument()
    })
  })

  it('changes the password and shows confirmation', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.type(screen.getByLabelText(/current password/i), 'old-password')
    await user.type(screen.getByLabelText(/new password/i), 'brand-new-password')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(screen.getByText(/password updated/i)).toBeInTheDocument()
    })
  })

  it('shows an error when the current password is wrong', async () => {
    server.use(
      http.patch('/api/account/password', () =>
        HttpResponse.json({ error: 'invalid_current_password' }, { status: 403 }),
      ),
    )
    const user = userEvent.setup()
    renderSettings()

    await user.type(screen.getByLabelText(/current password/i), 'wrong')
    await user.type(screen.getByLabelText(/new password/i), 'brand-new-password')
    await user.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument()
    })
  })

  it('updates the business name and slug and shows confirmation', async () => {
    const user = userEvent.setup()
    renderSettings()

    const name = screen.getByLabelText(/business name/i)
    await user.clear(name)
    await user.type(name, 'Acme Barbershop')
    await user.click(screen.getByRole('button', { name: /save business/i }))

    await waitFor(() => {
      expect(screen.getByText(/business details updated/i)).toBeInTheDocument()
    })
  })

  it('shows an error when the slug is already taken', async () => {
    server.use(
      http.patch('/api/tenants/:tenantId', () =>
        HttpResponse.json({ error: 'slug_taken' }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderSettings()

    const slug = screen.getByLabelText(/^slug$/i)
    await user.clear(slug)
    await user.type(slug, 'taken-slug')
    await user.click(screen.getByRole('button', { name: /save business/i }))

    await waitFor(() => {
      expect(screen.getByText(/this url is already taken/i)).toBeInTheDocument()
    })
  })

  it('deletes the account after password confirmation and redirects to /login', async () => {
    let deleteHit = false
    server.use(
      http.delete('/api/tenants/:tenantId', () => {
        deleteHit = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByRole('button', { name: /delete account/i }))

    const dialog = await screen.findByRole('alertdialog')
    await user.type(within(dialog).getByLabelText(/password/i), 'my-password')
    await user.click(within(dialog).getByRole('button', { name: /delete account/i }))

    await waitFor(() => {
      expect(deleteHit).toBe(true)
      expect(mockReplace).toHaveBeenCalledWith('/login')
    })
  })

  it('keeps the account and shows an error when the delete password is wrong', async () => {
    server.use(
      http.delete('/api/tenants/:tenantId', () =>
        HttpResponse.json({ error: 'invalid_password' }, { status: 403 }),
      ),
    )
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByRole('button', { name: /delete account/i }))

    const dialog = await screen.findByRole('alertdialog')
    await user.type(within(dialog).getByLabelText(/password/i), 'wrong')
    await user.click(within(dialog).getByRole('button', { name: /delete account/i }))

    await waitFor(() => {
      expect(within(dialog).getByText(/incorrect password/i)).toBeInTheDocument()
    })
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
