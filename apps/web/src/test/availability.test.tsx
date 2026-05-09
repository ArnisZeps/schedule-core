import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../../providers/AuthProvider'
import { server } from './handlers'
import { http, HttpResponse } from 'msw'
import { AvailabilityPage } from '@/page-components/services/AvailabilityPage'
import { TEST_TOKEN, TENANT_ID } from './handlers'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({ serviceId: 'res-1' })),
  usePathname: vi.fn(() => '/services/res-1/availability'),
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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider><AvailabilityPage /></AuthProvider>
    </QueryClientProvider>,
  )
}

describe('Availability rules', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('sc_token', TEST_TOKEN)
  })

  it('shows existing time windows in the weekly grid', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('09:00')).toBeInTheDocument()
      expect(screen.getByText('17:00')).toBeInTheDocument()
    })
  })

  it('add window form submits and new rule appears in grid', async () => {
    const user = userEvent.setup()

    server.use(
      http.get(
        `http://localhost:3001/tenants/${TENANT_ID}/services/res-1/availability-rules`,
        () =>
          HttpResponse.json([
            { id: 'rule-1', serviceId: 'res-1', dayOfWeek: 0, startTime: '09:00', endTime: '17:00' },
            { id: 'rule-new', serviceId: 'res-1', dayOfWeek: 2, startTime: '10:00', endTime: '18:00' },
          ]),
      ),
    )

    renderPage()
    await waitFor(() => screen.getByText('09:00'))

    // Open the day Select, pick Tuesday (index 2)
    await user.click(screen.getByRole('combobox', { name: /day/i }))
    await user.click(screen.getByRole('option', { name: /tuesday/i }))

    await user.type(screen.getByLabelText(/start time/i), '10:00')
    await user.type(screen.getByLabelText(/end time/i), '18:00')
    await user.click(screen.getByRole('button', { name: /add window/i }))

    await waitFor(() => {
      expect(screen.getByText('10:00')).toBeInTheDocument()
      expect(screen.getByText('18:00')).toBeInTheDocument()
    })
  })

  it('shows inline error on overlapping window', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(
        `http://localhost:3001/tenants/${TENANT_ID}/services/res-1/availability-rules`,
        () => HttpResponse.json({ message: 'Overlapping availability window' }, { status: 409 }),
      ),
    )

    renderPage()
    await waitFor(() => screen.getByText('09:00'))

    await user.click(screen.getByRole('combobox', { name: /day/i }))
    await user.click(screen.getByRole('option', { name: /sunday/i }))

    await user.type(screen.getByLabelText(/start time/i), '09:00')
    await user.type(screen.getByLabelText(/end time/i), '17:00')
    await user.click(screen.getByRole('button', { name: /add window/i }))

    await waitFor(() => {
      expect(screen.getByText(/overlapping availability window/i)).toBeInTheDocument()
    })
  })

  it('delete removes rule from grid', async () => {
    const user = userEvent.setup()

    renderPage()
    await waitFor(() => screen.getByText('09:00'))

    server.use(
      http.get(
        `http://localhost:3001/tenants/${TENANT_ID}/services/res-1/availability-rules`,
        () => HttpResponse.json([]),
      ),
    )

    await user.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(screen.queryByText('09:00')).not.toBeInTheDocument()
    })
  })
})
