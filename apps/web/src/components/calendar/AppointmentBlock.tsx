import { differenceInMinutes, getHours, getMinutes, format } from 'date-fns'
import type { Booking } from '@/hooks/useBookings'

const STATUS_CLASSES: Record<Booking['status'], string> = {
  pending: 'bg-amber-100 border-amber-300 text-amber-900',
  confirmed: 'bg-blue-100 border-blue-300 text-blue-900',
  cancelled: 'bg-muted border-border text-muted-foreground',
}

const HOUR_PX = 64

interface AppointmentBlockProps {
  booking: Booking
  colIndex: number
  colCount: number
  onClick: (booking: Booking) => void
}

export function AppointmentBlock({ booking, colIndex, colCount, onClick }: AppointmentBlockProps) {
  const start = new Date(booking.startAt)
  const end = new Date(booking.endAt)
  const startMinutes = getHours(start) * 60 + getMinutes(start)
  const durationMinutes = differenceInMinutes(end, start)

  const top = (startMinutes / 60) * HOUR_PX
  const height = Math.max(24, (durationMinutes / 60) * HOUR_PX)
  const left = `${(colIndex / colCount) * 100}%`
  const width = `calc(${(1 / colCount) * 100}% - 2px)`
  const showTimeRange = durationMinutes >= 30

  return (
    <button
      data-booking-id={booking.id}
      className={`absolute overflow-hidden rounded border px-1 py-0.5 text-left text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity ${STATUS_CLASSES[booking.status]}`}
      style={{ top, height, left, width }}
      onClick={() => onClick(booking)}
      aria-label={`${booking.clientName} appointment`}
    >
      <span className="block truncate leading-tight">{booking.clientName}</span>
      {showTimeRange && (
        <span
          data-testid="appointment-time-range"
          className="block truncate leading-tight opacity-80"
        >
          {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
        </span>
      )}
    </button>
  )
}
