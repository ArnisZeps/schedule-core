import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useParams } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../../providers/AuthProvider'
import { server } from './handlers'
import { http, HttpResponse } from 'msw'
import { ServiceListPage } from '@/page-components/services/ServiceListPage'
import { ServiceFormPage } from '@/page-components/services/ServiceFormPage'
import { TEST_TOKEN, TENANT_ID } from './handlers'

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
  vi.mocked(useParams).mockReturnValue({})
})

function renderPage(component: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>{component}</AuthProvider>
    </QueryClientProvider>,
  )
}

describe('Services', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('sc_token', TEST_TOKEN)
  })

  it('lists services for authenticated tenant', async () => {
    renderPage(<ServiceListPage />)

    await waitFor(() => {
      expect(screen.getByText('Meeting Room A')).toBeInTheDocument()
      expect(screen.getByText('Staff: Alice')).toBeInTheDocument()
    })
  })

  it('shows empty state when no services exist', async () => {
    server.use(
      http.get(`http://localhost:3001/tenants/${TENANT_ID}/services`, () =>
        HttpResponse.json([]),
      ),
    )
    renderPage(<ServiceListPage />)

    await waitFor(() => {
      expect(screen.getByText(/no services yet/i)).toBeInTheDocument()
    })
  })

  it('create form adds service and returns to list', async () => {
    const user = userEvent.setup()
    renderPage(<ServiceFormPage />)

    await user.type(screen.getByLabelText(/name/i), 'New Room')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/services')
    })
  })

  it('edit form is pre-populated with service values', async () => {
    vi.mocked(useParams).mockReturnValue({ serviceId: 'res-1' })
    renderPage(<ServiceFormPage />)

    await waitFor(() => {
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Meeting Room A')
    })
  })

  it('delete removes service from list after confirmation', async () => {
    const user = userEvent.setup()
    renderPage(<ServiceListPage />)

    await waitFor(() => screen.getByText('Meeting Room A'))

    server.use(
      http.get(`http://localhost:3001/tenants/${TENANT_ID}/services`, () =>
        HttpResponse.json([]),
      ),
    )

    const rows = screen.getAllByRole('row')
    const firstRow = rows.find(r => within(r).queryByText('Meeting Room A'))!
    await user.click(within(firstRow).getByRole('button', { name: /actions/i }))
    await user.click(screen.getByRole('menuitem', { name: /delete/i }))
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.getByText(/no services yet/i)).toBeInTheDocument()
    })
  })

  it('service stays in list when delete fails', async () => {
    const user = userEvent.setup()

    server.use(
      http.delete(`http://localhost:3001/tenants/${TENANT_ID}/services/:serviceId`, () =>
        HttpResponse.json({ message: 'Service has existing bookings' }, { status: 409 }),
      ),
    )

    renderPage(<ServiceListPage />)
    await waitFor(() => screen.getByText('Meeting Room A'))

    const rows = screen.getAllByRole('row')
    const firstRow = rows.find(r => within(r).queryByText('Meeting Room A'))!
    await user.click(within(firstRow).getByRole('button', { name: /actions/i }))
    await user.click(screen.getByRole('menuitem', { name: /delete/i }))
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.getByText('Meeting Room A')).toBeInTheDocument()
    })
  })
})
