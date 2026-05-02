import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routes } from '../App'
import { TEST_TOKEN } from './handlers'

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

describe('Auth guard', () => {
  beforeEach(() => localStorage.clear())

  it('redirects unauthenticated user from /resources to /login', async () => {
    const router = renderAt('/resources')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
  })

  it('allows authenticated user to access /resources', async () => {
    localStorage.setItem('sc_token', TEST_TOKEN)
    renderAt('/resources')

    await waitFor(() => {
      expect(screen.getByText(/meeting room a/i)).toBeInTheDocument()
    })
  })
})
