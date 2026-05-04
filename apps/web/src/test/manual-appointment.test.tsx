import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from './handlers'
import { routes } from '@/App'
import { TEST_TOKEN, TENANT_ID, SLOTS } from './handlers'

const FIXED_NOW = new Date('2026-05-04T10:00:00.000Z')
const BASE = 'http://localhost:3001'

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

describe('Manual appointment entry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)
    localStorage.clear()
    localStorage.setItem('sc_token', TEST_TOKEN)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('panel opens via toolbar "New appointment" button', async () => {
    renderAt('/appointments?view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    expect(screen.getByTestId('new-appointment-panel')).toBeInTheDocument()
  })

  it('panel closes when backdrop is clicked', async () => {
    renderAt('/appointments?view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    expect(screen.getByTestId('new-appointment-panel')).toBeInTheDocument()
    // The backdrop div is directly behind the panel; click it
    const backdrop = screen.getByTestId('new-appointment-panel').previousSibling as HTMLElement
    fireEvent.click(backdrop)
    expect(screen.queryByTestId('new-appointment-panel')).not.toBeInTheDocument()
  })

  it('slot grid renders available and taken states', async () => {
    renderAt('/appointments?view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    await waitFor(() => expect(screen.getAllByTestId('slot-available').length).toBeGreaterThan(0))
    expect(screen.getAllByTestId('slot-taken').length).toBeGreaterThan(0)
  })

  it('conflict warning appears when taken slot is selected', async () => {
    renderAt('/appointments?view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    await waitFor(() => expect(screen.getAllByTestId('slot-taken').length).toBeGreaterThan(0))
    const takenBtn = screen.getAllByTestId('slot-taken')[0]
    await userEvent.click(takenBtn)
    expect(screen.getByTestId('conflict-warning')).toBeInTheDocument()
  })

  it('form submit triggers query invalidation and closes panel', async () => {
    let postCalled = false
    server.use(
      http.post(`${BASE}/tenants/${TENANT_ID}/bookings`, async ({ request }) => {
        postCalled = true
        const body = await request.json() as Record<string, unknown>
        return HttpResponse.json(
          {
            id: 'bk-new',
            tenantId: TENANT_ID,
            serviceId: body.serviceId,
            clientName: body.clientName,
            clientPhone: body.clientPhone,
            clientEmail: null,
            startAt: body.startAt,
            endAt: body.endAt,
            status: 'pending',
            notes: null,
            createdAt: new Date().toISOString(),
          },
          { status: 201 },
        )
      }),
    )

    renderAt('/appointments?view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)

    // Fill in required fields
    await userEvent.type(screen.getByLabelText('Name'), 'Test Client')
    await userEvent.type(screen.getByLabelText('Phone'), '+1 555 123 4567')

    // Select an available slot
    await waitFor(() => expect(screen.getAllByTestId('slot-available').length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByTestId('slot-available')[0])

    await userEvent.click(screen.getByTestId('submit-booking'))

    await waitFor(() => expect(postCalled).toBe(true))
    await waitFor(() => expect(screen.queryByTestId('new-appointment-panel')).not.toBeInTheDocument())
  })

  it('shows validation error when name is missing', async () => {
    renderAt('/appointments?view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    // Only fill phone, not name
    await userEvent.type(screen.getByLabelText('Phone'), '+1 555 000 0000')
    await userEvent.click(screen.getByTestId('submit-booking'))
    expect(screen.getByTestId('panel-error')).toHaveTextContent('name')
  })

  it('shows validation error when phone is too short', async () => {
    renderAt('/appointments?view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    await userEvent.type(screen.getByLabelText('Name'), 'Test Client')
    await userEvent.type(screen.getByLabelText('Phone'), '123')
    await userEvent.click(screen.getByTestId('submit-booking'))
    expect(screen.getByTestId('panel-error')).toHaveTextContent('Phone')
  })
})
