import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from './handlers'
import {
  PUBLIC_LOCATIONS, PUBLIC_SERVICES, PUBLIC_STAFF, PUBLIC_SLOTS, PUBLIC_BOOKING_RESULT,
} from './handlers'
import { ServiceSection } from '@/page-components/booking/ServiceSection'
import { StaffSection } from '@/page-components/booking/StaffSection'
import { BookingCalendar } from '@/page-components/booking/BookingCalendar'
import { TimeSlotGrid } from '@/page-components/booking/TimeSlotGrid'
import { DetailsSection } from '@/page-components/booking/DetailsSection'
import { FloatingNav } from '@/page-components/booking/FloatingNav'
import { BookingWidget } from '@/page-components/booking/BookingWidget'

const TENANT_SLUG = 'test-biz'
const SINGLE_LOCATION = [PUBLIC_LOCATIONS[0]]
const MULTI_LOCATIONS = PUBLIC_LOCATIONS

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

// ── ServiceSection ────────────────────────────────────────────────────────────

describe('ServiceSection', () => {
  it('renders a card for each service', () => {
    render(
      <ServiceSection
        services={PUBLIC_SERVICES}
        isLoading={false}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('Haircut')).toBeInTheDocument()
    expect(screen.getByText('Shave')).toBeInTheDocument()
  })

  it('shows a skeleton when isLoading is true', () => {
    render(<ServiceSection services={[]} isLoading selectedId={null} onSelect={vi.fn()} />)
    expect(screen.getByTestId('service-skeleton')).toBeInTheDocument()
  })

  it('calls onSelect with the service id when a card is clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <ServiceSection
        services={PUBLIC_SERVICES}
        isLoading={false}
        selectedId={null}
        onSelect={onSelect}
      />,
    )
    await user.click(screen.getByText('Haircut'))
    expect(onSelect).toHaveBeenCalledWith('pub-svc-1')
  })

  it('visually highlights the selected service', () => {
    render(
      <ServiceSection
        services={PUBLIC_SERVICES}
        isLoading={false}
        selectedId="pub-svc-1"
        onSelect={vi.fn()}
      />,
    )
    const card = screen.getByText('Haircut').closest('[data-selected]')
    expect(card).toBeInTheDocument()
  })
})

// ── StaffSection ──────────────────────────────────────────────────────────────

describe('StaffSection', () => {
  it('always renders "Any available" as the first option', () => {
    render(
      <StaffSection
        staff={PUBLIC_STAFF}
        isLoading={false}
        selectedId={null}
        onSelect={vi.fn()}
        prerequisiteMet
      />,
    )
    expect(screen.getByText(/any available/i)).toBeInTheDocument()
  })

  it('renders a card for each staff member', () => {
    render(
      <StaffSection
        staff={PUBLIC_STAFF}
        isLoading={false}
        selectedId={null}
        onSelect={vi.fn()}
        prerequisiteMet
      />,
    )
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
  })

  it('calls onSelect with "any" when "Any available" is clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <StaffSection
        staff={PUBLIC_STAFF}
        isLoading={false}
        selectedId={null}
        onSelect={onSelect}
        prerequisiteMet
      />,
    )
    await user.click(screen.getByText(/any available/i))
    expect(onSelect).toHaveBeenCalledWith('any')
  })

  it('shows placeholder text when prerequisite is not met', () => {
    render(
      <StaffSection
        staff={[]}
        isLoading={false}
        selectedId={null}
        onSelect={vi.fn()}
        prerequisiteMet={false}
      />,
    )
    expect(screen.getByText(/select a service first/i)).toBeInTheDocument()
  })

  it('shows a skeleton when isLoading is true and prerequisite is met', () => {
    render(<StaffSection staff={[]} isLoading selectedId={null} onSelect={vi.fn()} prerequisiteMet />)
    expect(screen.getByTestId('staff-skeleton')).toBeInTheDocument()
  })
})

// ── BookingCalendar ───────────────────────────────────────────────────────────

describe('BookingCalendar', () => {
  const mayMonth = new Date(2026, 4, 1) // May 1, 2026
  const minMonth = new Date(2026, 4, 1)
  const maxMonth = new Date(2026, 7, 1) // Aug 1, 2026
  const availableDates = new Set(['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07'])

  function getDayButton(dayNum: number): HTMLElement {
    return screen.getAllByRole('button').find(
      b => b.textContent?.trim() === String(dayNum),
    )!
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-04T08:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows skeleton overlay when availableDates is null', () => {
    render(
      <BookingCalendar
        availableDates={null}
        selectedDate={null}
        onSelect={vi.fn()}
        month={mayMonth}
        onMonthChange={vi.fn()}
        minMonth={minMonth}
        maxMonth={maxMonth}
      />,
    )
    expect(screen.getByTestId('calendar-skeleton')).toBeInTheDocument()
  })

  it('available day is not disabled', () => {
    render(
      <BookingCalendar
        availableDates={availableDates}
        selectedDate={null}
        onSelect={vi.fn()}
        month={mayMonth}
        onMonthChange={vi.fn()}
        minMonth={minMonth}
        maxMonth={maxMonth}
      />,
    )
    expect(getDayButton(5)).not.toBeDisabled() // May 5 — in set, future
  })

  it('unavailable day in month is disabled', () => {
    render(
      <BookingCalendar
        availableDates={availableDates}
        selectedDate={null}
        onSelect={vi.fn()}
        month={mayMonth}
        onMonthChange={vi.fn()}
        minMonth={minMonth}
        maxMonth={maxMonth}
      />,
    )
    expect(getDayButton(9)).toBeDisabled() // May 9 — not in available set
  })

  it('past day is disabled', () => {
    render(
      <BookingCalendar
        availableDates={availableDates}
        selectedDate={null}
        onSelect={vi.fn()}
        month={mayMonth}
        onMonthChange={vi.fn()}
        minMonth={minMonth}
        maxMonth={maxMonth}
      />,
    )
    expect(getDayButton(3)).toBeDisabled() // May 3 — before today (May 4)
  })

  it('clicking an available day calls onSelect with YYYY-MM-DD string', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <BookingCalendar
        availableDates={availableDates}
        selectedDate={null}
        onSelect={onSelect}
        month={mayMonth}
        onMonthChange={vi.fn()}
        minMonth={minMonth}
        maxMonth={maxMonth}
      />,
    )
    await user.click(getDayButton(5)) // May 5
    expect(onSelect).toHaveBeenCalledWith('2026-05-05')
  })

  it('previous month button is aria-disabled when on minMonth', () => {
    render(
      <BookingCalendar
        availableDates={availableDates}
        selectedDate={null}
        onSelect={vi.fn()}
        month={minMonth}
        onMonthChange={vi.fn()}
        minMonth={minMonth}
        maxMonth={maxMonth}
      />,
    )
    const prevBtn = screen.getByRole('button', { name: 'Go to the Previous Month' })
    expect(prevBtn).toHaveAttribute('aria-disabled', 'true')
  })

  it('does not render the real calendar when availableDates is null', () => {
    render(
      <BookingCalendar
        availableDates={null}
        selectedDate={null}
        onSelect={vi.fn()}
        month={mayMonth}
        onMonthChange={vi.fn()}
        minMonth={minMonth}
        maxMonth={maxMonth}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Go to the Previous Month' })).not.toBeInTheDocument()
  })

  it('renders 42 skeleton day cells (6 rows × 7) when loading', () => {
    render(
      <BookingCalendar
        availableDates={null}
        selectedDate={null}
        onSelect={vi.fn()}
        month={mayMonth}
        onMonthChange={vi.fn()}
        minMonth={minMonth}
        maxMonth={maxMonth}
      />,
    )
    expect(screen.getAllByTestId('calendar-skeleton-cell')).toHaveLength(42)
  })

  it('does not show skeleton when availableDates is provided', () => {
    render(
      <BookingCalendar
        availableDates={availableDates}
        selectedDate={null}
        onSelect={vi.fn()}
        month={mayMonth}
        onMonthChange={vi.fn()}
        minMonth={minMonth}
        maxMonth={maxMonth}
      />,
    )
    expect(screen.queryByTestId('calendar-skeleton')).not.toBeInTheDocument()
  })
})

// ── TimeSlotGrid ──────────────────────────────────────────────────────────────

describe('TimeSlotGrid', () => {
  it('renders a button for each slot', () => {
    render(
      <TimeSlotGrid
        slots={PUBLIC_SLOTS}
        isLoading={false}
        selectedSlot={null}
        onSelect={vi.fn()}
      />,
    )
    // 3 slots → 3 buttons (some available, some not)
    expect(screen.getAllByRole('button')).toHaveLength(PUBLIC_SLOTS.length)
  })

  it('disables buttons for unavailable slots', () => {
    render(
      <TimeSlotGrid
        slots={PUBLIC_SLOTS}
        isLoading={false}
        selectedSlot={null}
        onSelect={vi.fn()}
      />,
    )
    const buttons = screen.getAllByRole('button')
    const unavailableCount = PUBLIC_SLOTS.filter((s) => !s.available).length
    const disabledCount = buttons.filter((b) => b.hasAttribute('disabled')).length
    expect(disabledCount).toBe(unavailableCount)
  })

  it('calls onSelect when an available slot is clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <TimeSlotGrid
        slots={PUBLIC_SLOTS}
        isLoading={false}
        selectedSlot={null}
        onSelect={onSelect}
      />,
    )
    const enabledButtons = screen.getAllByRole('button').filter((b) => !b.hasAttribute('disabled'))
    await user.click(enabledButtons[0])
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ startAt: expect.any(String) }))
  })

  it('shows empty state when no slots provided', () => {
    render(
      <TimeSlotGrid
        slots={[]}
        isLoading={false}
        selectedSlot={null}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText(/no available times/i)).toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading is true', () => {
    render(
      <TimeSlotGrid
        slots={[]}
        isLoading
        selectedSlot={null}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByTestId('slot-skeleton')).toBeInTheDocument()
  })
})

// ── DetailsSection ────────────────────────────────────────────────────────────

describe('DetailsSection', () => {
  const selectedSlot = PUBLIC_SLOTS[0]

  it('blocks submit when name is empty', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<DetailsSection selectedSlot={selectedSlot} onSubmit={onSubmit} isSubmitting={false} submitError={null} />)
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/name/i)).toBeInTheDocument()
  })

  it('blocks submit when phone is shorter than 7 chars', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<DetailsSection selectedSlot={selectedSlot} onSubmit={onSubmit} isSubmitting={false} submitError={null} />)
    await user.type(screen.getByLabelText(/name/i), 'Jane')
    await user.type(screen.getByLabelText(/phone/i), '123')
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('blocks submit when email is present but invalid', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<DetailsSection selectedSlot={selectedSlot} onSubmit={onSubmit} isSubmitting={false} submitError={null} />)
    await user.type(screen.getByLabelText(/name/i), 'Jane')
    await user.type(screen.getByLabelText(/phone/i), '+371 20000001')
    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with valid name and phone', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<DetailsSection selectedSlot={selectedSlot} onSubmit={onSubmit} isSubmitting={false} submitError={null} />)
    await user.type(screen.getByLabelText(/name/i), 'Jane Doe')
    await user.type(screen.getByLabelText(/phone/i), '+371 20000001')
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      clientName: 'Jane Doe',
      clientPhone: '+371 20000001',
    }))
  })

  it('disables submit button while isSubmitting is true', () => {
    render(<DetailsSection selectedSlot={selectedSlot} onSubmit={vi.fn()} isSubmitting submitError={null} />)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })
})

// ── FloatingNav ───────────────────────────────────────────────────────────────

describe('FloatingNav', () => {
  it('renders one pill per section', () => {
    render(
      <FloatingNav
        sections={[
          { id: 'section-service', label: 'Service' },
          { id: 'section-staff', label: 'Staff' },
          { id: 'section-datetime', label: 'Time' },
        ]}
        activeSection="section-service"
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('calls scrollIntoView on the target section element when a pill is clicked', async () => {
    const user = userEvent.setup()
    const div = document.createElement('div')
    div.id = 'section-service'
    const scrollIntoView = vi.fn()
    div.scrollIntoView = scrollIntoView
    document.body.appendChild(div)

    render(
      <FloatingNav
        sections={[{ id: 'section-service', label: 'Service' }]}
        activeSection={null}
      />,
    )
    await user.click(screen.getByRole('button', { name: /service/i }))
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })

    document.body.removeChild(div)
  })
})

// ── BookingWidget full flow ───────────────────────────────────────────────────

describe('BookingWidget — single-location happy path', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-04T08:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows service cards on load', async () => {
    wrap(
      <BookingWidget
        tenantName="Test Biz"
        tenantSlug={TENANT_SLUG}
        initialLocations={SINGLE_LOCATION}
        initialServices={[]}
        initialStaffByService={{}}
      />,
    )
    expect(await screen.findByText('Haircut')).toBeInTheDocument()
    expect(screen.getByText('Shave')).toBeInTheDocument()
  })

  it('staff section shows placeholder until a service is selected', async () => {
    wrap(
      <BookingWidget
        tenantName="Test Biz"
        tenantSlug={TENANT_SLUG}
        initialLocations={SINGLE_LOCATION}
        initialServices={[]}
        initialStaffByService={{}}
      />,
    )
    await screen.findByText('Haircut')
    expect(screen.getByText(/select a service first/i)).toBeInTheDocument()
  })

  it('full happy path ends on confirmation screen', async () => {
    const user = userEvent.setup({ delay: null })
    wrap(
      <BookingWidget
        tenantName="Test Biz"
        tenantSlug={TENANT_SLUG}
        initialLocations={SINGLE_LOCATION}
        initialServices={[]}
        initialStaffByService={{}}
      />,
    )

    // Select service
    await user.click(await screen.findByText('Haircut'))

    // Select "Any available" staff
    await user.click(await screen.findByText(/any available/i))

    // Wait for available dates to load, then click the first enabled calendar day
    let firstAvailDay: HTMLElement
    await waitFor(() => {
      const availDays = screen.getAllByRole('button').filter(
        b => /^\d{1,2}$/.test(b.textContent?.trim() ?? '') && !b.hasAttribute('disabled'),
      )
      expect(availDays.length).toBeGreaterThan(0)
      firstAvailDay = availDays[0]
    })
    await user.click(firstAvailDay!)

    // Select first available slot
    const availableSlots = await screen.findAllByRole('button', {
      name: /\d+:\d+\s*(am|pm)/i,
    })
    const enabledSlot = availableSlots.find((b) => !b.hasAttribute('disabled'))!
    await user.click(enabledSlot)

    // Fill in details
    await user.type(screen.getByLabelText(/name/i), 'Jane Doe')
    await user.type(screen.getByLabelText(/phone/i), '+371 20000001')

    // Submit
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    // Confirmation screen
    expect(await screen.findByText(/booking confirmed/i)).toBeInTheDocument()
    expect(screen.getByText('Haircut')).toBeInTheDocument()
  })
})

describe('BookingWidget — 409 slot conflict', () => {
  beforeEach(() => {
    server.use(
      http.post('/api/public/:tenantSlug/bookings', () =>
        HttpResponse.json({ error: 'overlap' }, { status: 409 }),
      ),
    )
  })

  it('shows error message and clears selected slot on 409', async () => {
    const user = userEvent.setup({ delay: null })
    wrap(
      <BookingWidget
        tenantName="Test Biz"
        tenantSlug={TENANT_SLUG}
        initialLocations={SINGLE_LOCATION}
        initialServices={[]}
        initialStaffByService={{}}
      />,
    )

    await user.click(await screen.findByText('Haircut'))
    await user.click(await screen.findByText(/any available/i))

    let firstAvailDay: HTMLElement
    await waitFor(() => {
      const availDays = screen.getAllByRole('button').filter(
        b => /^\d{1,2}$/.test(b.textContent?.trim() ?? '') && !b.hasAttribute('disabled'),
      )
      expect(availDays.length).toBeGreaterThan(0)
      firstAvailDay = availDays[0]
    })
    await user.click(firstAvailDay!)

    const availableSlots = await screen.findAllByRole('button', { name: /\d+:\d+\s*(am|pm)/i })
    const enabledSlot = availableSlots.find((b) => !b.hasAttribute('disabled'))!
    await user.click(enabledSlot)

    await user.type(screen.getByLabelText(/name/i), 'Jane Doe')
    await user.type(screen.getByLabelText(/phone/i), '+371 20000001')
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    expect(await screen.findByText(/just taken/i)).toBeInTheDocument()
    // After 409, the confirmation screen should NOT appear
    expect(screen.queryByText(/booking confirmed/i)).not.toBeInTheDocument()
  })
})

// ── BookingWidget — SSR pre-fetch ─────────────────────────────────────────────

describe('BookingWidget — initialServices pre-fetch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-05-04T08:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders service cards immediately without waiting for a fetch', () => {
    wrap(
      <BookingWidget
        tenantName="Test Biz"
        tenantSlug={TENANT_SLUG}
        initialLocations={SINGLE_LOCATION}
        initialServices={PUBLIC_SERVICES}
        initialStaffByService={{}}
      />,
    )
    // Synchronous — no await
    expect(screen.getByText('Haircut')).toBeInTheDocument()
    expect(screen.getByText('Shave')).toBeInTheDocument()
  })

  it('renders staff cards immediately after service selection when initialStaffByService has data', async () => {
    const user = userEvent.setup({ delay: null })
    wrap(
      <BookingWidget
        tenantName="Test Biz"
        tenantSlug={TENANT_SLUG}
        initialLocations={SINGLE_LOCATION}
        initialServices={PUBLIC_SERVICES}
        initialStaffByService={{ 'pub-svc-1': PUBLIC_STAFF }}
      />,
    )
    await user.click(screen.getByText('Haircut'))
    // Staff visible immediately — no findBy
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
  })
})
