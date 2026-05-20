import { useRef, useEffect } from 'react'
import { parseISO, format, getHours } from 'date-fns'
import type { Booking } from '@/hooks/useBookings'
import { TimeGutter } from './TimeGutter'
import { DayColumn } from './DayColumn'

const HOUR_PX = 64

interface DayViewProps {
  dateStr: string
  bookings: Booking[]
  onBookingClick: (booking: Booking) => void
  onTimeSelect?: (startAt: Date, endAt: Date) => void
}

export function DayView({ dateStr, bookings, onBookingClick, onTimeSelect }: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const day = parseISO(dateStr)

  useEffect(() => {
    if (!scrollRef.current) return
    const hour = getHours(new Date())
    const target = hour < 6 || hour > 22 ? 8 * HOUR_PX : hour * HOUR_PX - 128
    scrollRef.current.scrollTop = Math.max(0, target)
  }, [])

  const dayBookings = bookings.filter(b => b.startAt.slice(0, 10) === dateStr)

  return (
    <div className="flex-1 overflow-y-auto min-w-0" ref={scrollRef}>
      {/* Sticky day header */}
      <div className="flex sticky top-0 bg-background z-10 border-b">
        <div className="w-16 flex-shrink-0" />
        <div className="flex-1 text-center py-2 text-xs font-medium text-muted-foreground">
          {format(day, 'EEEE, MMM d')}
        </div>
      </div>

      {/* Time grid */}
      <div className="flex">
        <TimeGutter />
        <DayColumn date={day} bookings={dayBookings} onBookingClick={onBookingClick} onTimeSelect={onTimeSelect} />
      </div>
    </div>
  )
}
