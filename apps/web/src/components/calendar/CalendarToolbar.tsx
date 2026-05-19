'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { addDays, subDays, parseISO, format } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Service } from '@/hooks/useServices'
import type { Staff } from '@/hooks/useStaff'

interface CalendarToolbarProps {
  services: Service[]
  staffList?: Staff[]
  selectedStaffId?: string
  onNewAppointment?: () => void
}

export function CalendarToolbar({ services, staffList = [], selectedStaffId, onNewAppointment }: CalendarToolbarProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const isMobile = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches
  const view = (searchParams.get('view') || (isMobile ? 'day' : 'week')) as 'week' | 'day' | 'list'
  const dateStr = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
  const serviceId = searchParams.get('serviceId') || undefined

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (value === null) next.delete(key)
    else next.set(key, value)
    router.push(`/appointments?${next.toString()}`)
  }

  function navigate(direction: 'prev' | 'next' | 'today') {
    if (direction === 'today') {
      setParam('date', format(new Date(), 'yyyy-MM-dd'))
      return
    }
    const current = parseISO(dateStr)
    const days = view === 'day' ? 1 : 7
    const next = direction === 'next' ? addDays(current, days) : subDays(current, days)
    setParam('date', format(next, 'yyyy-MM-dd'))
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 md:px-6 md:py-3 border-b bg-background flex-shrink-0">
      <Button variant="outline" size="sm" onClick={() => navigate('today')}>
        Today
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => navigate('prev')}
        aria-label="Prev"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => navigate('next')}
        aria-label="Next"
      >
        <ChevronRight className="size-4" />
      </Button>

      <div className="flex-1" />

      <Button size="sm" onClick={onNewAppointment} data-testid="new-appointment-btn">
        <Plus className="size-4 mr-1" />
        New appointment
      </Button>

      {/* View toggle + service filter — wraps to second row on mobile */}
      <div className="flex items-center gap-2 w-full md:w-auto">
        <div className="flex border rounded-md overflow-hidden">
          {(['week', 'day', 'list'] as const).map(v => (
            <Button
              key={v}
              variant={view === v ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setParam('view', v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>

        <Select
          value={serviceId ?? 'all'}
          onValueChange={val => setParam('serviceId', val === 'all' ? null : val)}
        >
          <SelectTrigger className="flex-1 md:w-44 md:flex-none" aria-label="Service">
            <SelectValue placeholder="All services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {services.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedStaffId ?? 'all'}
          onValueChange={val => setParam('staffId', val === 'all' ? null : val)}
        >
          <SelectTrigger className="flex-1 md:w-44 md:flex-none" aria-label="Staff">
            <SelectValue placeholder="All staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All staff</SelectItem>
            {staffList.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
