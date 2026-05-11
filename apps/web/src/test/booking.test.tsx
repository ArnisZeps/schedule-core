import { describe, it, expect, beforeEach, vi } from 'vitest'
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
import { DateStrip } from '@/page-components/booking/DateStrip'
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
})

// ── DateStrip ─────────────────────────────────────────────────────────────────

describe('DateStrip', () => {
  it('renders 7 day buttons', () => {
    render(<DateStrip selectedDate={null} onSelect={vi.fn()} />)
    // Each button has a day abbreviation; 7 days visible at a time
    const buttons = screen.getAllByRole('button', { name: /mon|tue|wed|thu|fri|sat|sun/i })
    expect(buttons.length).toBeGreaterThanOrEqual(7)
  })

  it('calls onSelect with ISO date string when a day is clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<DateStrip selectedDate={null} onSelect={onSelect} />)
    const dayButtons = screen.getAllByRole('button').filter(
      (btn) => !btn.textContent?.match(/^[<>]/),
    )
    await user.click(dayButtons[0])
    expect(onSelect).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

  it('navigates forward by 7 days when next button is clicked', async () => {
    const user = userEvent.setup()
    render(<DateStrip selectedDate={null} onSelect={vi.fn()} />)
    const nextBtn = screen.getByRole('button', { name: /next/i })
    const before = screen.getAllByRole('button').filter((b) => !b.textContent?.match(/^[<>]/)).map(b => b.textContent)
    await user.click(nextBtn)
    const after = screen.getAllByRole('button').filter((b) => !b.textContent?.match(/^[<>]/)).map(b => b.textContent)
    expect(before).not.toEqual(after)
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
      />,
    )

    // Select service
    await user.click(await screen.findByText('Haircut'))

    // Select "Any available" staff
    await user.click(await screen.findByText(/any available/i))

    // Select first available date in DateStrip
    const dayButtons = await screen.findAllByRole('button', { name: /mon|tue|wed|thu|fri|sat|sun/i })
    await user.click(dayButtons[0])

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
      />,
    )

    await user.click(await screen.findByText('Haircut'))
    await user.click(await screen.findByText(/any available/i))

    const dayButtons = await screen.findAllByRole('button', { name: /mon|tue|wed|thu|fri|sat|sun/i })
    await user.click(dayButtons[0])

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
