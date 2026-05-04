import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from './handlers'
import { http, HttpResponse } from 'msw'
import { routes } from '@/App'

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

describe('Login page', () => {
  beforeEach(() => localStorage.clear())

  it('happy path: valid credentials redirect to /services', async () => {
    const user = userEvent.setup()
    const router = renderAt('/login')

    await user.type(screen.getByLabelText(/email/i), 'owner@test.com')
    await user.type(screen.getByLabelText(/password/i), 'password')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/services')
    })
  })

  it('invalid credentials show inline error without page reload', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('http://localhost:3001/auth/login', () =>
        HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 }),
      ),
    )
    renderAt('/login')

    await user.type(screen.getByLabelText(/email/i), 'wrong@test.com')
    await user.type(screen.getByLabelText(/password/i), 'badpassword')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })
})
