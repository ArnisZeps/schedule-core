import { useRef, useEffect } from 'react'
import { eachDayOfInterval, startOfWeek, endOfWeek, format, parseISO, isToday } from 'date-fns'
import { getHours } from 'date-fns'
import type { Booking } from '@/hooks/useBookings'
import { TimeGutter } from './TimeGutter'
import { DayColumn } from './DayColumn'

const HOUR_PX = 64

interface WeekViewProps {
  dateStr: string
  bookings: Booking[]
  onBookingClick: (booking: Booking) => void
  onTimeSelect?: (startAt: Date, endAt: Date) => void
}

export function WeekView({ dateStr, bookings, onBookingClick, onTimeSelect }: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const weekStart = startOfWeek(parseISO(dateStr), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(parseISO(dateStr), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Scroll to current hour on mount
  useEffect(() => {
    if (!scrollRef.current) return
    const hour = getHours(new Date())
    const target = hour < 6 || hour > 22 ? 8 * HOUR_PX : hour * HOUR_PX - 128
    scrollRef.current.scrollTop = Math.max(0, target)
  }, [])

  function bookingsForDay(day: Date): Booking[] {
    const dayStr = format(day, 'yyyy-MM-dd')
    return bookings.filter(b => b.startAt.slice(0, 10) === dayStr)
  }

  return (
    <div className="flex-1 overflow-y-auto min-w-0" ref={scrollRef}>
      {/* Sticky day headers */}
      <div className="flex sticky top-0 bg-background z-10 border-b min-w-[640px]">
        <div className="w-16 flex-shrink-0" />
        {days.map(day => (
          <div
            key={day.toISOString()}
            className={`flex-1 text-center py-2 text-xs font-medium ${isToday(day) ? 'text-blue-600' : 'text-muted-foreground'}`}
          >
            {format(day, 'EEE d')}
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex min-w-[640px]">
        <TimeGutter />
        {days.map(day => (
          <DayColumn
            key={day.toISOString()}
            date={day}
            bookings={bookingsForDay(day)}
            onBookingClick={onBookingClick}
            onTimeSelect={onTimeSelect}
          />
        ))}
      </div>
    </div>
  )
}
