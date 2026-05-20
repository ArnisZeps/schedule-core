'use client'

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
  view: 'week' | 'day' | 'list'
  dateStr: string
  serviceId?: string
  selectedStaffId?: string
  onNavigate: (direction: 'prev' | 'next' | 'today') => void
  onViewChange: (view: 'week' | 'day' | 'list') => void
  onServiceChange: (serviceId: string | undefined) => void
  onStaffChange: (staffId: string | undefined) => void
  onNewAppointment?: () => void
}

export function CalendarToolbar({
  services,
  staffList = [],
  view,
  dateStr: _dateStr,
  serviceId,
  selectedStaffId,
  onNavigate,
  onViewChange,
  onServiceChange,
  onStaffChange,
  onNewAppointment,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 md:px-6 md:py-3 border-b bg-background flex-shrink-0">
      <Button variant="outline" size="sm" onClick={() => onNavigate('today')}>
        Today
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onNavigate('prev')}
        aria-label="Prev"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onNavigate('next')}
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
              onClick={() => onViewChange(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>

        <Select
          value={serviceId ?? 'all'}
          onValueChange={val => onServiceChange(val === 'all' ? undefined : val)}
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
          onValueChange={val => onStaffChange(val === 'all' ? undefined : val)}
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
