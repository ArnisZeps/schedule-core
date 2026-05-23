import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useSearchParams } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserProvider } from '@/components/UserProvider'
import { http, HttpResponse } from 'msw'
import { server } from './handlers'
import { AppointmentsPage } from '@/page-components/appointments/AppointmentsPage'
import { TENANT_ID, BOOKINGS, SLOTS } from './handlers'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => '/appointments'),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={String(href)} {...props as object}>{children}</a>,
}))

const FIXED_NOW = new Date('2026-05-04T10:00:00.000Z')
const BASE = '/api'

let mockReplace: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockReplace = vi.fn()
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), replace: mockReplace, back: vi.fn() } as any)
})

function renderAppointments(search = 'view=week&date=2026-05-04') {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(search) as any)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <UserProvider user={{ userId: 'user-1', tenantId: 'tenant-1' }}><AppointmentsPage /></UserProvider>
    </QueryClientProvider>,
  )
}

async function openDetailDialog(user: ReturnType<typeof userEvent.setup>, bookingId = 'bk-1') {
  renderAppointments('view=week&date=2026-05-04')
  await waitFor(() => screen.getByTestId(`booking-block-${bookingId}`))
  await user.click(screen.getByTestId(`booking-block-${bookingId}`))
  return waitFor(() => screen.getByRole('dialog'))
}

// ─── Reschedule panel ────────────────────────────────────────────────────────

describe('Reschedule panel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)
    localStorage.clear()
  })
  afterEach(() => { vi.useRealTimers() })

  it('detail dialog has no datetime-local inputs', async () => {
    const user = userEvent.setup()
    await openDetailDialog(user, 'bk-1')
    expect(screen.queryByLabelText(/new start/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/new end/i)).not.toBeInTheDocument()
  })

  it('detail dialog shows "Reschedule appointment" button', async () => {
    const user = userEvent.setup()
    const dialog = await openDetailDialog(user, 'bk-1')
    expect(within(dialog).getByRole('button', { name: /reschedule appointment/i })).toBeInTheDocument()
  })

  it('clicking "Reschedule appointment" closes the dialog and opens the panel', async () => {
    const user = userEvent.setup()
    const dialog = await openDetailDialog(user, 'bk-1')
    await user.click(within(dialog).getByRole('button', { name: /reschedule appointment/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByTestId('new-appointment-panel')).toBeInTheDocument()
    })
  })

  it('panel title reads "Reschedule appointment" in reschedule mode', async () => {
    const user = userEvent.setup()
    const dialog = await openDetailDialog(user, 'bk-1')
    await user.click(within(dialog).getByRole('button', { name: /reschedule appointment/i }))
    await waitFor(() => screen.getByTestId('new-appointment-panel'))
    expect(screen.getByTestId('panel-title')).toHaveTextContent('Reschedule appointment')
  })

  it('panel pre-fills client name as read-only', async () => {
    const user = userEvent.setup()
    const dialog = await openDetailDialog(user, 'bk-1')
    await user.click(within(dialog).getByRole('button', { name: /reschedule appointment/i }))
    await waitFor(() => screen.getByTestId('new-appointment-panel'))
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    expect(nameInput.value).toBe(BOOKINGS[0].clientName)
    expect(nameInput).toHaveAttribute('readonly')
  })

  it('selecting a slot and submitting sends PATCH (not POST) with slot times', async () => {
    let patchBody: Record<string, unknown> | null = null
    let postCalled = false
    server.use(
      http.patch(`${BASE}/tenants/${TENANT_ID}/bookings/bk-1`, async ({ request }) => {
        patchBody = await request.json() as Record<string, unknown>
        return HttpResponse.json({ ...BOOKINGS[0], startAt: patchBody.startAt, endAt: patchBody.endAt })
      }),
      http.post(`${BASE}/tenants/${TENANT_ID}/bookings`, () => {
        postCalled = true
        return HttpResponse.json({}, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    const dialog = await openDetailDialog(user, 'bk-1')
    await user.click(within(dialog).getByRole('button', { name: /reschedule appointment/i }))
    await waitFor(() => screen.getByTestId('new-appointment-panel'))
    await waitFor(() => expect(screen.getAllByTestId('slot-available').length).toBeGreaterThan(0))
    await user.click(screen.getAllByTestId('slot-available')[0])
    await user.click(screen.getByTestId('submit-booking'))
    await waitFor(() => expect(patchBody).not.toBeNull())
    expect(patchBody!.startAt).toBeDefined()
    expect(patchBody!.endAt).toBeDefined()
    expect(postCalled).toBe(false)
    await waitFor(() => expect(screen.queryByTestId('new-appointment-panel')).not.toBeInTheDocument())
  })

  it('409 on reschedule shows inline error and keeps panel open', async () => {
    server.use(
      http.patch(`${BASE}/tenants/${TENANT_ID}/bookings/bk-1`, () =>
        HttpResponse.json({ error: 'overlap' }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    const dialog = await openDetailDialog(user, 'bk-1')
    await user.click(within(dialog).getByRole('button', { name: /reschedule appointment/i }))
    await waitFor(() => screen.getByTestId('new-appointment-panel'))
    await waitFor(() => expect(screen.getAllByTestId('slot-available').length).toBeGreaterThan(0))
    await user.click(screen.getAllByTestId('slot-available')[0])
    await user.click(screen.getByTestId('submit-booking'))
    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.getByTestId('new-appointment-panel')).toBeInTheDocument()
  })
})

// ─── Custom time section ─────────────────────────────────────────────────────

describe('Custom time section', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)
    localStorage.clear()
  })
  afterEach(() => { vi.useRealTimers() })

  async function openNewPanel() {
    renderAppointments('view=week&date=2026-05-04')
    const btn = await screen.findByTestId('new-appointment-btn')
    await userEvent.click(btn)
    return waitFor(() => screen.getByTestId('new-appointment-panel'))
  }

  it('custom time section is collapsed by default showing toggle text', async () => {
    await openNewPanel()
    expect(screen.getByTestId('custom-time-toggle')).toBeInTheDocument()
    expect(screen.queryByTestId('custom-time-input')).not.toBeInTheDocument()
  })

  it('expanding custom time hides the slot grid', async () => {
    await openNewPanel()
    await waitFor(() => expect(screen.getAllByTestId('slot-available').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByTestId('custom-time-toggle'))
    expect(screen.queryByTestId('slot-grid')).not.toBeInTheDocument()
  })

  it('expanding custom time shows time input', async () => {
    await openNewPanel()
    await userEvent.click(screen.getByTestId('custom-time-toggle'))
    expect(screen.getByTestId('custom-time-input')).toBeInTheDocument()
  })

  it('toggling custom time off restores the slot grid', async () => {
    await openNewPanel()
    await waitFor(() => expect(screen.getAllByTestId('slot-available').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByTestId('custom-time-toggle'))
    await userEvent.click(screen.getByTestId('custom-time-toggle'))
    await waitFor(() => expect(screen.getByTestId('slot-grid')).toBeInTheDocument())
  })

  it('submit button is disabled when custom time active but no time entered', async () => {
    await openNewPanel()
    await userEvent.type(screen.getByLabelText('Name'), 'Test Client')
    await userEvent.type(screen.getByLabelText('Phone'), '+1 555 123 4567')
    await userEvent.click(screen.getByTestId('custom-time-toggle'))
    expect(screen.getByTestId('submit-booking')).toBeDisabled()
  })

  it('submitting with custom time sends override: true in POST body', async () => {
    let capturedBody: Record<string, unknown> | null = null
    server.use(
      http.post(`${BASE}/tenants/${TENANT_ID}/bookings`, async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>
        return HttpResponse.json({
          id: 'bk-new', tenantId: TENANT_ID, serviceId: capturedBody.serviceId,
          locationId: 'loc-1', staffId: null, staffName: null,
          clientName: capturedBody.clientName, clientPhone: capturedBody.clientPhone,
          clientEmail: null, startAt: capturedBody.startAt, endAt: capturedBody.endAt,
          status: 'pending', notes: null, createdAt: new Date().toISOString(),
        }, { status: 201 })
      }),
    )
    await openNewPanel()
    await userEvent.type(screen.getByLabelText('Name'), 'Test Client')
    await userEvent.type(screen.getByLabelText('Phone'), '+1 555 123 4567')
    await userEvent.click(screen.getByTestId('custom-time-toggle'))
    await userEvent.type(screen.getByTestId('custom-time-input'), '14:00')
    await userEvent.click(screen.getByTestId('submit-booking'))
    await waitFor(() => expect(capturedBody).not.toBeNull())
    expect(capturedBody!.override).toBe(true)
    expect(capturedBody!.startAt).toBeDefined()
  })

  it('custom time section also appears in reschedule mode', async () => {
    const user = userEvent.setup()
    const dialog = await openDetailDialog(user, 'bk-1')
    await user.click(within(dialog).getByRole('button', { name: /reschedule appointment/i }))
    await waitFor(() => screen.getByTestId('new-appointment-panel'))
    expect(screen.getByTestId('custom-time-toggle')).toBeInTheDocument()
  })
})
