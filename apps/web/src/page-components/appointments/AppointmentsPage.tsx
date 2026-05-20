'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { format, parseISO, isValid, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { useServices, type Service } from '@/hooks/useServices'
import { useBookings, type Booking } from '@/hooks/useBookings'
import { useBookingsPrefetch } from '@/hooks/useBookingsPrefetch'
import { useLocations, type Location } from '@/hooks/useLocations'
import { useStaffList, type Staff } from '@/hooks/useStaff'
import { useAuth } from '@/hooks/useAuth'
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar'
import { WeekView } from '@/components/calendar/WeekView'
import { DayView } from '@/components/calendar/DayView'
import { ListView } from '@/components/calendar/ListView'
import { AppointmentDetailDialog } from '@/components/calendar/AppointmentDetailDialog'
import { NewAppointmentPanel } from '@/components/calendar/NewAppointmentPanel'
import { ErrorState } from '@/components/ui/ErrorState'

export interface ServiceStaffEntry {
  serviceId: string
  locationId: string
  staff: Staff[]
}

interface AppointmentsPageProps {
  initialBookings?: Booking[]
  initialServices?: Service[]
  initialStaff?: Staff[]
  initialLocations?: Location[]
  initialServiceStaff?: ServiceStaffEntry[]
}

export function AppointmentsPage({
  initialBookings,
  initialServices,
  initialStaff,
  initialLocations,
  initialServiceStaff,
}: AppointmentsPageProps = {}) {
  const params = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const tenantId = user!.tenantId
  const queryClient = useQueryClient()

  // Seed React Query cache from SSR data — runs once synchronously before child components mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (!initialServiceStaff?.length) return
    for (const entry of initialServiceStaff) {
      queryClient.setQueryData(['service-staff', tenantId, entry.serviceId, entry.locationId], entry.staff)
    }
  }, []) // intentionally empty: seed once from SSR data

  const isMobile = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches

  const [view, setView] = useState<'week' | 'day' | 'list'>(() =>
    (params.get('view') as 'week' | 'day' | 'list') || (isMobile ? 'day' : 'week')
  )
  const [dateStr, setDateStr] = useState<string>(() => {
    const d = params.get('date')
    if (d) {
      const parsed = parseISO(d)
      if (isValid(parsed)) return d
    }
    return format(new Date(), 'yyyy-MM-dd')
  })
  const [serviceId, setServiceId] = useState<string | undefined>(() =>
    params.get('serviceId') ?? undefined
  )
  const [staffId, setStaffId] = useState<string | undefined>(() =>
    params.get('staffId') ?? undefined
  )

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [prefillStart, setPrefillStart] = useState<Date | undefined>()
  const [prefillEnd, setPrefillEnd] = useState<Date | undefined>()

  useEffect(() => {
    const next = new URLSearchParams()
    if (view !== 'week') next.set('view', view)
    if (dateStr !== format(new Date(), 'yyyy-MM-dd')) next.set('date', dateStr)
    if (serviceId) next.set('serviceId', serviceId)
    if (staffId) next.set('staffId', staffId)
    const qs = next.toString()
    router.replace(`/appointments${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [view, dateStr, serviceId, staffId, router])

  function handleNavigate(direction: 'prev' | 'next' | 'today') {
    if (direction === 'today') {
      setDateStr(format(new Date(), 'yyyy-MM-dd'))
      return
    }
    const days = view === 'day' ? 1 : 7
    setDateStr(format(addDays(parseISO(dateStr), direction === 'next' ? days : -days), 'yyyy-MM-dd'))
  }

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
        view={view}
        dateStr={dateStr}
        serviceId={serviceId}
        selectedStaffId={staffId}
        onNavigate={handleNavigate}
        onViewChange={setView}
        onServiceChange={setServiceId}
        onStaffChange={setStaffId}
        onNewAppointment={handleNewAppointment}
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
