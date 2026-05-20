'use client'

import { useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { format, parseISO, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { useServices, type Service } from '@/hooks/useServices'
import { useBookings, type Booking } from '@/hooks/useBookings'
import { useBookingsPrefetch } from '@/hooks/useBookingsPrefetch'
import { useLocations, type Location } from '@/hooks/useLocations'
import { useStaffList, type Staff } from '@/hooks/useStaff'
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar'
import { WeekView } from '@/components/calendar/WeekView'
import { DayView } from '@/components/calendar/DayView'
import { ListView } from '@/components/calendar/ListView'
import { AppointmentDetailDialog } from '@/components/calendar/AppointmentDetailDialog'
import { NewAppointmentPanel } from '@/components/calendar/NewAppointmentPanel'
import { ErrorState } from '@/components/ui/ErrorState'

interface AppointmentsPageProps {
  initialBookings?: Booking[]
  initialServices?: Service[]
  initialStaff?: Staff[]
  initialLocations?: Location[]
}

export function AppointmentsPage({
  initialBookings,
  initialServices,
  initialStaff,
  initialLocations,
}: AppointmentsPageProps = {}) {
  const params = useSearchParams()
  const [isNavigating, startNavigation] = useTransition()
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [prefillStart, setPrefillStart] = useState<Date | undefined>()
  const [prefillEnd, setPrefillEnd] = useState<Date | undefined>()

  const isMobile = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches
  const view = (params.get('view') || (isMobile ? 'day' : 'week')) as 'week' | 'day' | 'list'
  const dateStr = params.get('date') || format(new Date(), 'yyyy-MM-dd')
  const serviceId = params.get('serviceId') || undefined
  const staffId = params.get('staffId') || undefined

  const { data: services = [] } = useServices(initialServices)
  const { data: locations = [] } = useLocations(true, initialLocations)
  const { data: staffList = [] } = useStaffList(undefined, undefined, initialStaff)

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
    data: rawBookings = [],
    isLoading: bookingsLoading,
    isError: bookingsError,
    refetch,
  } = useBookings({ from, to, serviceId, initialData: initialBookings })

  useBookingsPrefetch({ view, from, to, serviceId })

  const bookings = staffId ? rawBookings.filter(b => b.staffId === staffId) : rawBookings

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
      <CalendarToolbar
        services={services}
        staffList={staffList}
        selectedStaffId={staffId}
        onNewAppointment={handleNewAppointment}
        startNavigation={startNavigation}
      />

      {view === 'list' ? (
        <ListView
          serviceId={serviceId}
          staffId={staffId}
          services={services}
          onBookingClick={setSelectedBooking}
        />
      ) : bookingsLoading ? (
        <div className="flex flex-1 overflow-hidden animate-pulse">
          <div className="w-14 shrink-0 border-r">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-16 border-b flex items-start pt-1 px-2">
                <div className="h-3 w-8 rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="flex flex-1 overflow-x-auto">
            {Array.from({ length: view === 'week' ? 7 : 1 }).map((_, col) => (
              <div key={col} className="flex-1 min-w-[80px] border-r last:border-0">
                <div className="h-10 border-b flex flex-col items-center justify-center gap-1">
                  <div className="h-3 w-6 rounded bg-muted" />
                  <div className="h-4 w-4 rounded-full bg-muted" />
                </div>
                {Array.from({ length: 12 }).map((_, row) => (
                  <div key={row} className="h-16 border-b last:border-0" />
                ))}
              </div>
            ))}
          </div>
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
          className={isNavigating ? 'opacity-50 pointer-events-none' : undefined}
        />
      ) : (
        <DayView
          dateStr={dateStr}
          bookings={bookings}
          onBookingClick={setSelectedBooking}
          onTimeSelect={handleTimeSelect}
          className={isNavigating ? 'opacity-50 pointer-events-none' : undefined}
        />
      )}

      {selectedBooking && (
        <AppointmentDetailDialog
          booking={selectedBooking}
          services={services}
          locations={locations}
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
