'use client'

import { DateStrip } from './DateStrip'
import { TimeSlotGrid } from './TimeSlotGrid'
import { usePublicSlots } from '@/hooks/usePublicBooking'
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
  const { data: slots = [], isLoading } = usePublicSlots(
    tenantSlug,
    serviceId,
    locationId,
    staffId,
    selectedDate,
  )

  return (
    <section id="section-datetime" className="space-y-3">
      <h2 className="text-lg font-semibold">Date &amp; Time</h2>
      {!staffSelected ? (
        <p className="text-sm text-muted-foreground">Select a staff member first.</p>
      ) : (
        <div className="space-y-4">
          <DateStrip selectedDate={selectedDate} onSelect={onDateSelect} />
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
