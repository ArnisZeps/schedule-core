import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { useServices } from '@/hooks/useServices'
import { useBookings, type Booking } from '@/hooks/useBookings'
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar'
import { WeekView } from '@/components/calendar/WeekView'
import { DayView } from '@/components/calendar/DayView'
import { ListView } from '@/components/calendar/ListView'
import { AppointmentDetailDialog } from '@/components/calendar/AppointmentDetailDialog'
import { NewAppointmentPanel } from '@/components/calendar/NewAppointmentPanel'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'

export function AppointmentsPage() {
  const [params] = useSearchParams()
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [prefillStart, setPrefillStart] = useState<Date | undefined>()
  const [prefillEnd, setPrefillEnd] = useState<Date | undefined>()

  const isMobile = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches
  const view = (params.get('view') || (isMobile ? 'day' : 'week')) as 'week' | 'day' | 'list'
  const dateStr = params.get('date') || format(new Date(), 'yyyy-MM-dd')
  const serviceId = params.get('serviceId') || undefined

  const { data: services = [] } = useServices()

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
  } = useBookings({ from, to, serviceId })

  function handleTimeSelect(startAt: Date, endAt: Date) {
    setPrefillStart(startAt)
    setPrefillEnd(endAt)
    setPanelOpen(true)
  }

  function handleNewAppointment() {
    setPrefillStart(undefined)
    setPrefillEnd(undefined)
    setPanelOpen(true)
  }

  function handleClosePanel() {
    setPanelOpen(false)
    setPrefillStart(undefined)
    setPrefillEnd(undefined)
  }

  return (
    <div
      className="-m-6 flex flex-col overflow-hidden relative"
      style={{ height: 'calc(100vh - 3.5rem)' }}
    >
      <CalendarToolbar services={services} onNewAppointment={handleNewAppointment} />

      {view === 'list' ? (
        <ListView
          serviceId={serviceId}
          services={services}
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
          onTimeSelect={handleTimeSelect}
        />
      ) : (
        <DayView
          dateStr={dateStr}
          bookings={bookings}
          onBookingClick={setSelectedBooking}
          onTimeSelect={handleTimeSelect}
        />
      )}

      {selectedBooking && (
        <AppointmentDetailDialog
          booking={selectedBooking}
          services={services}
          open={true}
          onClose={() => setSelectedBooking(null)}
        />
      )}

      {panelOpen && (
        <>
          <div
            className="absolute inset-0 z-20"
            onClick={handleClosePanel}
            aria-hidden="true"
          />
          <NewAppointmentPanel
            services={services}
            prefillStart={prefillStart}
            prefillEnd={prefillEnd}
            onClose={handleClosePanel}
          />
        </>
      )}
    </div>
  )
}
