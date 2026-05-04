import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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

describe('Services', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('sc_token', TEST_TOKEN)
  })

  it('lists services for authenticated tenant', async () => {
    renderAt('/services')

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
    renderAt('/services')

    await waitFor(() => {
      expect(screen.getByText(/no services yet/i)).toBeInTheDocument()
    })
  })

  it('create form adds service and returns to list', async () => {
    const user = userEvent.setup()
    const router = renderAt('/services/new')

    await user.type(screen.getByLabelText(/name/i), 'New Room')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/services')
    })
  })

  it('edit form is pre-populated with service values', async () => {
    renderAt('/services/res-1')

    await waitFor(() => {
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Meeting Room A')
    })
  })

  it('delete removes service from list after confirmation', async () => {
    const user = userEvent.setup()
    renderAt('/services')

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

    renderAt('/services')
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
