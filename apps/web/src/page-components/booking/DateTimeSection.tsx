'use client'

import { useState, useMemo } from 'react'
import { BookingCalendar } from './BookingCalendar'
import { TimeSlotGrid } from './TimeSlotGrid'
import { usePublicSlots, usePublicAvailableDates } from '@/hooks/usePublicBooking'
import type { PublicSlot } from '@/hooks/usePublicBooking'

interface Props {
  tenantSlug: string
  serviceId: string | null
  locationId: string | null
  staffId: string | null
  timezone: string
  staffSelected: boolean
  selectedDate: string | null
  selectedSlot: PublicSlot | null
  onDateSelect: (date: string | null) => void
  onSlotSelect: (slot: PublicSlot) => void
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function firstOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function lastOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  d.setHours(0, 0, 0, 0)
  return d
}

export function DateTimeSection({
  tenantSlug,
  serviceId,
  locationId,
  staffId,
  timezone,
  staffSelected,
  selectedDate,
  selectedSlot,
  onDateSelect,
  onSlotSelect,
}: Props) {
  const [month, setMonth] = useState<Date>(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  })

  const { minMonth, maxMonth } = useMemo(() => {
    const now = new Date()
    const min = firstOfMonth(now)
    const max = new Date(now.getFullYear(), now.getMonth() + 3, 1)
    max.setHours(0, 0, 0, 0)
    return { minMonth: min, maxMonth: max }
  }, [])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // startDate = max(today, first of month)
  const startDate = toDateStr(month >= today ? firstOfMonth(month) : today)
  const endDate = toDateStr(lastOfMonth(month))

  const { data: slots = [], isLoading } = usePublicSlots(
    tenantSlug,
    serviceId,
    locationId,
    staffId,
    selectedDate,
  )

  const { data: availableDatesArr, isLoading: isDatesLoading } = usePublicAvailableDates(
    tenantSlug,
    serviceId,
    locationId,
    staffId,
    startDate,
    endDate,
    staffSelected,
  )

  const availableDates = isDatesLoading ? null : new Set(availableDatesArr ?? [])

  function handleMonthChange(newMonth: Date) {
    setMonth(newMonth)
    onDateSelect(null)
  }

  return (
    <section id="section-datetime" className="space-y-3">
      <h2 className="text-lg font-semibold">Date &amp; Time</h2>
      {!staffSelected ? (
        <p className="text-sm text-muted-foreground">Select a staff member first.</p>
      ) : (
        <div className="flex flex-col gap-6 sm:flex-row">
          <BookingCalendar
            availableDates={availableDates}
            selectedDate={selectedDate}
            onSelect={onDateSelect}
            month={month}
            onMonthChange={handleMonthChange}
            minMonth={minMonth}
            maxMonth={maxMonth}
          />
          {selectedDate && (
            <div className="flex-1 pt-2">
              <TimeSlotGrid
                slots={slots}
                selectedSlot={selectedSlot}
                onSelect={onSlotSelect}
                isLoading={isLoading}
                timezone={timezone}
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
