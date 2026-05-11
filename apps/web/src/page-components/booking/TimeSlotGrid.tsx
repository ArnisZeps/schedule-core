'use client'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { PublicSlot } from '@/hooks/usePublicBooking'

interface Props {
  slots: PublicSlot[]
  selectedSlot: PublicSlot | null
  onSelect: (slot: PublicSlot) => void
  isLoading: boolean
  timezone?: string
}

function formatTime(iso: string, timezone = 'UTC') {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(iso))
}

export function TimeSlotGrid({ slots, selectedSlot, onSelect, isLoading, timezone }: Props) {
  if (isLoading) {
    return (
      <div data-testid="slot-skeleton" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-xl" />
        ))}
      </div>
    )
  }

  const available = slots.filter((s) => s.available)
  if (slots.length === 0 || available.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No available times on this date. Try a different date.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => {
        const isSelected =
          selectedSlot?.startAt === slot.startAt && selectedSlot?.endAt === slot.endAt
        return (
          <button
            key={slot.startAt}
            onClick={() => onSelect(slot)}
            disabled={!slot.available}
            className={cn(
              'rounded-xl border p-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40',
              isSelected && 'border-primary bg-accent font-semibold',
            )}
          >
            {formatTime(slot.startAt, timezone)}
          </button>
        )
      })}
    </div>
  )
}
