import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from './handlers'
import { http, HttpResponse } from 'msw'
import { routes } from '@/App'
import { TEST_TOKEN, TENANT_ID, STAFF, STAFF_OVERRIDES } from './handlers'

const BASE = 'http://localhost:3001'
// July 1 2026 is a Wednesday — override data (ov-1: Jul 1, ov-2: Jul 4-6) is in this week
const FIXED_TODAY = new Date('2026-07-01T10:00:00.000Z')

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

describe('Staff', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('sc_token', TEST_TOKEN)
  })

  // ---------------------------------------------------------------------------
  // Staff list
  // ---------------------------------------------------------------------------

  describe('Staff list', () => {
    it('renders active staff members', async () => {
      renderAt('/staff')
      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument()
        expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()
      })
    })

    it('show-inactive toggle reveals deactivated staff', async () => {
      const user = userEvent.setup()
      renderAt('/staff')
      await waitFor(() => screen.getByText('Alice Smith'))
      await user.click(screen.getByRole('checkbox', { name: /show inactive/i }))
      await waitFor(() => {
        expect(screen.getByText('Bob Jones')).toBeInTheDocument()
      })
    })

    it('add staff button is present', async () => {
      renderAt('/staff')
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /add staff/i })).toBeInTheDocument()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Staff create form
  // ---------------------------------------------------------------------------

  describe('Staff create form', () => {
    it('name required validation prevents submit', async () => {
      const user = userEvent.setup()
      renderAt('/staff/new')
      await waitFor(() => screen.getByLabelText(/name/i))
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument()
      })
    })

    it('invalid email format shows validation error', async () => {
      const user = userEvent.setup()
      renderAt('/staff/new')
      await waitFor(() => screen.getByLabelText(/name/i))
      await user.type(screen.getByLabelText(/name/i), 'Test Staff')
      await user.type(screen.getByLabelText(/email/i), 'not-an-email')
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
      })
    })

    it('valid submit navigates to the new staff detail page', async () => {
      const user = userEvent.setup()
      const router = renderAt('/staff/new')
      await waitFor(() => screen.getByLabelText(/name/i))
      await user.type(screen.getByLabelText(/name/i), 'New Staff')
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(router.state.location.pathname).toMatch(/^\/staff\//)
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Staff detail — profile
  // ---------------------------------------------------------------------------

  describe('Staff detail — profile', () => {
    it('deactivate button opens confirmation dialog', async () => {
      const user = userEvent.setup()
      renderAt('/staff/staff-1')
      await waitFor(() => screen.getByText('Alice Smith'))
      await user.click(screen.getByRole('button', { name: /deactivate/i }))
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })
    })

    it('confirming deactivation sends PATCH { isActive: false }', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.patch(`${BASE}/tenants/${TENANT_ID}/staff/staff-1`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ ...STAFF[0], isActive: false })
        }),
      )
      renderAt('/staff/staff-1')
      await waitFor(() => screen.getByText('Alice Smith'))
      await user.click(screen.getByRole('button', { name: /deactivate/i }))
      await waitFor(() => screen.getByRole('alertdialog'))
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /confirm/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({ isActive: false })
      })
    })

    it('reactivate button sends PATCH { isActive: true } for inactive staff', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.patch(`${BASE}/tenants/${TENANT_ID}/staff/staff-2`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ ...STAFF[1], isActive: true })
        }),
      )
      renderAt('/staff/staff-2')
      await waitFor(() => screen.getByText('Bob Jones'))
      await user.click(screen.getByRole('button', { name: /reactivate/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({ isActive: true })
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Service assignment
  // ---------------------------------------------------------------------------

  describe('Service assignment', () => {
    it('checkboxes reflect assigned services', async () => {
      renderAt('/staff/staff-1')
      await waitFor(() => {
        // handler returns [SERVICES[0]] for GET /staff/:staffId/services
        expect(screen.getByRole('checkbox', { name: /meeting room a/i })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: /staff: alice/i })).not.toBeChecked()
      })
    })

    it('save triggers PUT with all checked service IDs', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.put(`${BASE}/tenants/${TENANT_ID}/staff/staff-1/services`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json([])
        }),
      )
      renderAt('/staff/staff-1')
      await waitFor(() => screen.getByRole('checkbox', { name: /meeting room a/i }))
      await user.click(screen.getByRole('checkbox', { name: /staff: alice/i }))
      await user.click(screen.getByRole('button', { name: /save services/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({
          serviceIds: expect.arrayContaining(['res-1', 'res-2']),
        })
      })
    })

    it('unchecking all and saving sends empty serviceIds array', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.put(`${BASE}/tenants/${TENANT_ID}/staff/staff-1/services`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json([])
        }),
      )
      renderAt('/staff/staff-1')
      await waitFor(() => screen.getByRole('checkbox', { name: /meeting room a/i }))
      await user.click(screen.getByRole('checkbox', { name: /meeting room a/i }))
      await user.click(screen.getByRole('button', { name: /save services/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({ serviceIds: [] })
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Weekly schedule calendar
  // ---------------------------------------------------------------------------

  describe('Weekly schedule calendar', () => {
    it('renders existing schedule windows', async () => {
      renderAt('/staff/staff-1')
      // sched-1: dayOfWeek=1 (Monday), 09:00–17:00
      const block = await screen.findByTestId('schedule-block')
      expect(within(block).getByText('09:00')).toBeInTheDocument()
      expect(within(block).getByText('17:00')).toBeInTheDocument()
    })

    it('drag on a weekday column creates a new pending block', async () => {
      renderAt('/staff/staff-1')
      // Tuesday column (dayOfWeek=2) — no existing block
      const col = await screen.findByTestId('weekday-col-2')
      // HOUR_PX=64, TOTAL_HEIGHT=1536: clientY=576 → 9:00, clientY=640 → 10:00
      // getBoundingClientRect().top is 0 in jsdom so no mocking needed
      fireEvent.mouseDown(col, { clientY: 576 })
      fireEvent.mouseMove(document, { clientY: 640 })
      fireEvent.mouseUp(document, { clientY: 640 })
      await waitFor(() => {
        expect(screen.getAllByTestId('schedule-block')).toHaveLength(2)
      })
    })

    it('clicking a schedule block opens a popover', async () => {
      const user = userEvent.setup()
      renderAt('/staff/staff-1')
      const block = await screen.findByTestId('schedule-block')
      await user.click(block)
      await waitFor(() => {
        expect(screen.getByTestId('schedule-block-popover')).toBeInTheDocument()
      })
    })

    it('popover delete removes the block', async () => {
      const user = userEvent.setup()
      renderAt('/staff/staff-1')
      const block = await screen.findByTestId('schedule-block')
      await user.click(block)
      await waitFor(() => screen.getByTestId('schedule-block-popover'))
      await user.click(
        within(screen.getByTestId('schedule-block-popover')).getByRole('button', { name: /delete/i }),
      )
      await waitFor(() => {
        expect(screen.queryByTestId('schedule-block')).not.toBeInTheDocument()
      })
    })

    it('save schedule sends PUT with windows payload', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.put(`${BASE}/tenants/${TENANT_ID}/staff/staff-1/schedules`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json([])
        }),
      )
      renderAt('/staff/staff-1')
      await waitFor(() => screen.getByRole('button', { name: /save schedule/i }))
      await user.click(screen.getByRole('button', { name: /save schedule/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({
          windows: expect.arrayContaining([
            expect.objectContaining({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }),
          ]),
        })
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Override calendar
  // ---------------------------------------------------------------------------

  describe('Override calendar', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(FIXED_TODAY)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('renders green block for available override', async () => {
      renderAt('/staff/staff-1')
      await waitFor(() => {
        const block = screen.getByTestId('override-block-ov-1')
        expect(block).toBeInTheDocument()
        expect(block).toHaveAttribute('data-override-type', 'available')
      })
    })

    it('renders red block for not_available override', async () => {
      renderAt('/staff/staff-1')
      await waitFor(() => {
        const block = screen.getByTestId(`override-block-${STAFF_OVERRIDES[1].id}`)
        expect(block).toBeInTheDocument()
        expect(block).toHaveAttribute('data-override-type', 'not_available')
      })
    })

    it('create override button opens blank panel', async () => {
      const user = userEvent.setup()
      renderAt('/staff/staff-1')
      await waitFor(() => screen.getByRole('button', { name: /create override/i }))
      await user.click(screen.getByRole('button', { name: /create override/i }))
      await waitFor(() => {
        expect(screen.getByTestId('override-panel')).toBeInTheDocument()
        expect((screen.getByLabelText(/start date/i) as HTMLInputElement).value).toBe('')
      })
    })

    it('clicking an override block opens panel in edit mode', async () => {
      const user = userEvent.setup()
      renderAt('/staff/staff-1')
      const block = await screen.findByTestId('override-block-ov-1')
      await user.click(block)
      await waitFor(() => {
        expect(screen.getByTestId('override-panel')).toBeInTheDocument()
        expect((screen.getByLabelText(/start date/i) as HTMLInputElement).value).toBe('2026-07-01')
      })
    })

    it('drag on override calendar column opens panel with pre-filled date and start time', async () => {
      renderAt('/staff/staff-1')
      // Thu July 2 — col testid uses ISO date; no existing override on this day
      const col = await screen.findByTestId('override-col-2026-07-03') // Friday
      // HOUR_PX=64, TOTAL_HEIGHT=1536: clientY=576 → 09:00
      fireEvent.mouseDown(col, { clientY: 576 })
      fireEvent.mouseMove(document, { clientY: 640 })
      fireEvent.mouseUp(document, { clientY: 640 })
      await waitFor(() => {
        expect(screen.getByTestId('override-panel')).toBeInTheDocument()
        expect((screen.getByLabelText(/start date/i) as HTMLInputElement).value).toBe('2026-07-03')
        expect((screen.getByLabelText(/start time/i) as HTMLInputElement).value).toBe('09:00')
      })
    })

    it('delete from panel triggers DELETE request and closes panel', async () => {
      const user = userEvent.setup()
      let deleteCalled = false
      server.use(
        http.delete(`${BASE}/tenants/${TENANT_ID}/staff/staff-1/overrides/ov-1`, () => {
          deleteCalled = true
          return new HttpResponse(null, { status: 204 })
        }),
      )
      renderAt('/staff/staff-1')
      const block = await screen.findByTestId('override-block-ov-1')
      await user.click(block)
      await waitFor(() => screen.getByTestId('override-panel'))
      await user.click(
        within(screen.getByTestId('override-panel')).getByRole('button', { name: /delete/i }),
      )
      await waitFor(() => {
        expect(deleteCalled).toBe(true)
        expect(screen.queryByTestId('override-panel')).not.toBeInTheDocument()
      })
    })
  })
})
