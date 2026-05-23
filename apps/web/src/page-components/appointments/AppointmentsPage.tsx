'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { HydrationBoundary } from '@tanstack/react-query'
import { useServices } from '@/hooks/useServices'
import { useBookings } from '@/hooks/useBookings'
import { useBookingsPrefetch } from '@/hooks/useBookingsPrefetch'
import { useLocations } from '@/hooks/useLocations'
import { useStaffList } from '@/hooks/useStaff'
import { useAuth } from '@/hooks/useAuth'
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar'
import { WeekView } from '@/components/calendar/WeekView'
import { DayView } from '@/components/calendar/DayView'
import { ListView } from '@/components/calendar/ListView'
import { AppointmentDetailDialog } from '@/components/calendar/AppointmentDetailDialog'
import { NewAppointmentPanel } from '@/components/calendar/NewAppointmentPanel'
import { ErrorState } from '@/components/ui/ErrorState'
import type { Booking } from '@/hooks/useBookings'

// UTC-based date helpers — timezone-safe, produce consistent keys on server and client

function utcWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00.000Z')
  const dow = d.getUTCDay()
  const adj = dow === 0 ? -6 : 1 - dow
  if (adj === 0) return dateStr
  return new Date(d.getTime() + adj * 86400000).toISOString().slice(0, 10)
}

function utcAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00.000Z')
  return new Date(d.getTime() + days * 86400000).toISOString().slice(0, 10)
}

function utcTodayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

interface AppointmentsPageProps {
  dehydratedState?: unknown
}

export function AppointmentsPage({ dehydratedState }: AppointmentsPageProps = {}) {
  return (
    <HydrationBoundary state={dehydratedState}>
      <AppointmentsPageInner />
    </HydrationBoundary>
  )
}

function AppointmentsPageInner() {
  const params = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()

  const isMobile = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches

  const [view, setView] = useState<'week' | 'day' | 'list'>(() =>
    (params.get('view') as 'week' | 'day' | 'list') || (isMobile ? 'day' : 'week')
  )
  const [dateStr, setDateStr] = useState<string>(() => {
    const viewParam = params.get('view') as 'week' | 'day' | 'list' | null
    if (viewParam === 'day') {
      const d = params.get('date')
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d
      return utcTodayStr()
    }
    // week view: read 'from' param (should already be a Monday)
    const f = params.get('from')
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) return f
    // default: UTC Monday of current week
    return utcWeekMonday(utcTodayStr())
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

    const today = utcTodayStr()
    if (view === 'week') {
      const todayMonday = utcWeekMonday(today)
      if (dateStr !== todayMonday) {
        next.set('from', dateStr)
        next.set('to', utcAddDays(dateStr, 7))
      }
    } else if (view === 'day') {
      if (dateStr !== today) next.set('date', dateStr)
    }

    if (serviceId) next.set('serviceId', serviceId)
    if (staffId) next.set('staffId', staffId)
    const qs = next.toString()
    router.replace(`/appointments${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [view, dateStr, serviceId, staffId, router])

  function handleNavigate(direction: 'prev' | 'next' | 'today') {
    if (direction === 'today') {
      const today = utcTodayStr()
      setDateStr(view === 'week' ? utcWeekMonday(today) : today)
      return
    }
    const step = view === 'day' ? 1 : 7
    setDateStr(utcAddDays(dateStr, direction === 'next' ? step : -step))
  }

  const { data: services = [] } = useServices()
  const { data: locations = [] } = useLocations(true)
  const { data: staffList = [] } = useStaffList()

  // ISO keys: UTC midnight, timezone-safe — matches server dehydration keys
  const fromISO = dateStr + 'T00:00:00.000Z'
  const toISO = (view === 'week' ? utcAddDays(dateStr, 7) : utcAddDays(dateStr, 1)) + 'T00:00:00.000Z'

  const {
    data: rawBookings = [],
    isLoading: bookingsLoading,
    isError: bookingsError,
    refetch,
  } = useBookings({ from: fromISO, to: toISO, serviceId })

  useBookingsPrefetch({ view, from: fromISO, to: toISO, serviceId })

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
            locations={locations}
            prefillStart={prefillStart}
            prefillEnd={prefillEnd}
            onClose={handleClosePanel}
          />
        </>
      )}
    </div>
  )
}
