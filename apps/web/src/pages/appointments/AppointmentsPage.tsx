import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { useResources } from '@/hooks/useResources'
import { useBookings, type Booking } from '@/hooks/useBookings'
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar'
import { WeekView } from '@/components/calendar/WeekView'
import { DayView } from '@/components/calendar/DayView'
import { ListView } from '@/components/calendar/ListView'
import { AppointmentDetailDialog } from '@/components/calendar/AppointmentDetailDialog'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'

export function AppointmentsPage() {
  const [params] = useSearchParams()
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  const view = (params.get('view') || 'week') as 'week' | 'day' | 'list'
  const dateStr = params.get('date') || format(new Date(), 'yyyy-MM-dd')
  const resourceId = params.get('resourceId') || undefined

  const { data: resources = [] } = useResources()

  // Compute date range for ranged views
  const date = parseISO(dateStr)
  const from =
    view === 'week'
      ? startOfWeek(date, { weekStartsOn: 1 }).toISOString()
      : date.toISOString()
  const to =
    view === 'week'
      ? addDays(endOfWeek(date, { weekStartsOn: 1 }), 1).toISOString()
      : addDays(date, 1).toISOString()

  const {
    data: bookings = [],
    isLoading: bookingsLoading,
    isError: bookingsError,
    refetch,
  } = useBookings({ from, to, resourceId })

  return (
    <div
      className="-m-6 flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 3.5rem)' }}
    >
      <CalendarToolbar resources={resources} />

      {view === 'list' ? (
        <ListView
          resourceId={resourceId}
          resources={resources}
          onBookingClick={setSelectedBooking}
        />
      ) : bookingsLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingState />
        </div>
      ) : bookingsError ? (
        <div className="flex-1 flex items-center justify-center">
          <ErrorState message="Failed to load appointments" onRetry={refetch} />
        </div>
      ) : view === 'week' ? (
        <WeekView
          dateStr={dateStr}
          bookings={bookings}
          onBookingClick={setSelectedBooking}
        />
      ) : (
        <DayView
          dateStr={dateStr}
          bookings={bookings}
          onBookingClick={setSelectedBooking}
        />
      )}

      {selectedBooking && (
        <AppointmentDetailDialog
          booking={selectedBooking}
          resources={resources}
          open={true}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  )
}
