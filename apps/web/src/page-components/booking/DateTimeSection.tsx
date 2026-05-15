'use client'

import { useState } from 'react'
import { DateStrip } from './DateStrip'
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
  onDateSelect: (date: string) => void
  onSlotSelect: (slot: PublicSlot) => void
}

const MAX_OFFSET = 60

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
  const [windowStart, setWindowStart] = useState(0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const windowStartDate = new Date(today)
  windowStartDate.setDate(today.getDate() + windowStart)
  const startDateStr = toDateStr(windowStartDate)

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
    startDateStr,
    staffSelected,
  )

  const availableDates = isDatesLoading ? null : new Set(availableDatesArr ?? [])

  return (
    <section id="section-datetime" className="space-y-3">
      <h2 className="text-lg font-semibold">Date &amp; Time</h2>
      {!staffSelected ? (
        <p className="text-sm text-muted-foreground">Select a staff member first.</p>
      ) : (
        <div className="space-y-4">
          <DateStrip
            selectedDate={selectedDate}
            onSelect={onDateSelect}
            windowStart={windowStart}
            onPrev={() => setWindowStart((w) => Math.max(0, w - 7))}
            onNext={() => setWindowStart((w) => Math.min(MAX_OFFSET - 7, w + 7))}
            availableDates={availableDates}
          />
          {selectedDate && (
            <TimeSlotGrid
              slots={slots}
              selectedSlot={selectedSlot}
              onSelect={onSlotSelect}
              isLoading={isLoading}
              timezone={timezone}
            />
          )}
        </div>
      )}
    </section>
  )
}
