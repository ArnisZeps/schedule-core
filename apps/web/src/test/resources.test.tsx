import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from './handlers'
import { http, HttpResponse } from 'msw'
import { routes } from '../App'
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

describe('Resources', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('sc_token', TEST_TOKEN)
  })

  it('lists resources for authenticated tenant', async () => {
    renderAt('/resources')

    await waitFor(() => {
      expect(screen.getByText('Meeting Room A')).toBeInTheDocument()
      expect(screen.getByText('Staff: Alice')).toBeInTheDocument()
    })
  })

  it('shows empty state when no resources exist', async () => {
    server.use(
      http.get(`http://localhost:3001/tenants/${TENANT_ID}/resources`, () =>
        HttpResponse.json([]),
      ),
    )
    renderAt('/resources')

    await waitFor(() => {
      expect(screen.getByText(/no resources yet/i)).toBeInTheDocument()
    })
  })

  it('create form adds resource and returns to list', async () => {
    const user = userEvent.setup()
    const router = renderAt('/resources/new')

    await user.type(screen.getByLabelText(/name/i), 'New Room')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/resources')
    })
  })

  it('edit form is pre-populated with resource values', async () => {
    renderAt('/resources/res-1')

    await waitFor(() => {
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Meeting Room A')
    })
  })

  it('delete removes resource from list after confirmation', async () => {
    const user = userEvent.setup()
    renderAt('/resources')

    await waitFor(() => screen.getByText('Meeting Room A'))

    server.use(
      http.get(`http://localhost:3001/tenants/${TENANT_ID}/resources`, () =>
        HttpResponse.json([]),
      ),
    )

    const rows = screen.getAllByRole('row')
    const firstRow = rows.find(r => within(r).queryByText('Meeting Room A'))!
    await user.click(within(firstRow).getByRole('button', { name: /actions/i }))
    await user.click(screen.getByRole('menuitem', { name: /delete/i }))
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.getByText(/no resources yet/i)).toBeInTheDocument()
    })
  })

  it('resource stays in list when delete fails', async () => {
    const user = userEvent.setup()

    server.use(
      http.delete(`http://localhost:3001/tenants/${TENANT_ID}/resources/:resourceId`, () =>
        HttpResponse.json({ message: 'Resource has existing bookings' }, { status: 409 }),
      ),
    )

    renderAt('/resources')
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
