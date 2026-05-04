import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from './handlers'
import { http, HttpResponse } from 'msw'
import { routes } from '@/App'
import { TEST_TOKEN, TENANT_ID } from './handlers'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('Availability rules', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('sc_token', TEST_TOKEN)
  })

  it('shows existing time windows in the weekly grid', async () => {
    renderAt('/services/res-1/availability')

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

    renderAt('/services/res-1/availability')
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

    renderAt('/services/res-1/availability')
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

    renderAt('/services/res-1/availability')
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
