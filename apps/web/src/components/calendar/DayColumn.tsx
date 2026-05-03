import { useEffect, useRef, useState } from 'react'
import { isToday, getHours, getMinutes } from 'date-fns'
import type { Booking } from '@/hooks/useBookings'
import { computeColumnLayout } from '@/lib/calendarLayout'
import { AppointmentBlock } from './AppointmentBlock'

const HOUR_PX = 64
const TOTAL_HEIGHT = HOUR_PX * 24

interface DayColumnProps {
  date: Date
  bookings: Booking[]
  onBookingClick: (booking: Booking) => void
}

function CurrentTimeIndicator() {
  const [top, setTop] = useState(() => {
    const now = new Date()
    return ((getHours(now) * 60 + getMinutes(now)) / 60) * HOUR_PX
  })

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTop(((getHours(now) * 60 + getMinutes(now)) / 60) * HOUR_PX)
    }
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top, height: 2, background: 'var(--color-red-500, #ef4444)' }}
    />
  )
}

export function DayColumn({ date, bookings, onBookingClick }: DayColumnProps) {
  const today = isToday(date)
  const layout = computeColumnLayout(bookings)

  return (
    <div
      className={`flex-1 relative border-l ${today ? 'bg-blue-50/40' : ''}`}
      style={{ height: TOTAL_HEIGHT }}
      data-testid={today ? 'today-column' : undefined}
    >
      {/* Hour grid lines */}
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} className="absolute left-0 right-0 border-t border-border/50" style={{ top: i * HOUR_PX }} />
      ))}
      {/* Half-hour dividers */}
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} className="absolute left-0 right-0 border-t border-border/20" style={{ top: i * HOUR_PX + 32 }} />
      ))}

      {today && <CurrentTimeIndicator />}

      {layout.map(({ booking, colIndex, colCount }) => (
        <AppointmentBlock
          key={booking.id}
          booking={booking}
          colIndex={colIndex}
          colCount={colCount}
          onClick={onBookingClick}
        />
      ))}
    </div>
  )
}
