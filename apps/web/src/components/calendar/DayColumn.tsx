import { useEffect, useRef, useState } from 'react'
import { isToday, getHours, getMinutes, addMinutes, startOfDay } from 'date-fns'
import type { Booking } from '@/hooks/useBookings'
import { computeColumnLayout } from '@/lib/calendarLayout'
import { AppointmentBlock } from './AppointmentBlock'

const HOUR_PX = 64
const TOTAL_HEIGHT = HOUR_PX * 24
const SLOT_MINUTES = 15

interface DayColumnProps {
  date: Date
  bookings: Booking[]
  onBookingClick: (booking: Booking) => void
  onTimeSelect?: (startAt: Date, endAt: Date) => void
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

function snapToSlot(minutes: number): number {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES
}

function minutesFromTop(y: number): number {
  return Math.max(0, Math.min(1440, (y / TOTAL_HEIGHT) * 1440))
}

export function DayColumn({ date, bookings, onBookingClick, onTimeSelect }: DayColumnProps) {
  const today = isToday(date)
  const layout = computeColumnLayout(bookings)
  const colRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startMin: number } | null>(null)
  const [ghost, setGhost] = useState<{ top: number; height: number } | null>(null)

  function getRelativeY(e: MouseEvent | React.MouseEvent): number {
    const rect = colRef.current!.getBoundingClientRect()
    return e.clientY - rect.top
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!onTimeSelect) return
    const rawMin = minutesFromTop(getRelativeY(e))
    const startMin = snapToSlot(rawMin)
    dragRef.current = { startMin }
    const top = (startMin / 60) * HOUR_PX
    setGhost({ top, height: (SLOT_MINUTES / 60) * HOUR_PX })

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const curMin = snapToSlot(minutesFromTop(getRelativeY(ev)))
      const lo = Math.min(dragRef.current.startMin, curMin)
      const hi = Math.max(dragRef.current.startMin, curMin) + SLOT_MINUTES
      setGhost({ top: (lo / 60) * HOUR_PX, height: ((hi - lo) / 60) * HOUR_PX })
    }

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!dragRef.current) return
      const curMin = snapToSlot(minutesFromTop(getRelativeY(ev)))
      const lo = Math.min(dragRef.current.startMin, curMin)
      const hi = Math.max(dragRef.current.startMin, curMin) + SLOT_MINUTES
      dragRef.current = null
      setGhost(null)
      if (onTimeSelect) {
        const base = startOfDay(date)
        onTimeSelect(addMinutes(base, lo), addMinutes(base, hi))
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={colRef}
      className={`flex-1 relative border-l select-none ${today ? 'bg-blue-50/40' : ''} ${onTimeSelect ? 'cursor-crosshair' : ''}`}
      style={{ height: TOTAL_HEIGHT }}
      data-testid={today ? 'today-column' : undefined}
      onMouseDown={handleMouseDown}
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

      {ghost && (
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none bg-blue-300/40 border border-blue-400 rounded"
          style={{ top: ghost.top, height: ghost.height }}
        />
      )}

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
