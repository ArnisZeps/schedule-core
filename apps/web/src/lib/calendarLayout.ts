import type { Booking } from '@/hooks/useBookings'

export interface BookingLayout {
  booking: Booking
  colIndex: number
  colCount: number
}

export function computeColumnLayout(bookings: Booking[]): BookingLayout[] {
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  )

  // columns[i] = latest endAt timestamp seen in that column
  const columns: number[] = []
  const result: Array<{ booking: Booking; colIndex: number }> = []

  for (const booking of sorted) {
    const start = new Date(booking.startAt).getTime()
    const end = new Date(booking.endAt).getTime()

    let assigned = -1
    for (let i = 0; i < columns.length; i++) {
      if (columns[i] <= start) {
        assigned = i
        break
      }
    }

    if (assigned === -1) {
      assigned = columns.length
      columns.push(end)
    } else {
      columns[assigned] = end
    }

    result.push({ booking, colIndex: assigned })
  }

  const colCount = columns.length || 1
  return result.map(r => ({ ...r, colCount }))
}
