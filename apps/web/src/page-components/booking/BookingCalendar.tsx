"use client"

import * as React from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Skeleton } from '@/components/ui/skeleton'

interface Props {
  availableDates: Set<string> | null
  selectedDate: string | null
  onSelect: (date: string) => void
  month: Date
  onMonthChange: (month: Date) => void
  minMonth: Date
  maxMonth: Date
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function CalendarSkeleton() {
  return (
    <div data-testid="calendar-skeleton" className="w-full sm:w-fit p-2">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="size-7 rounded-md" />
      </div>
      <div className="flex gap-1 mb-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="flex-1 h-3 rounded" />
        ))}
      </div>
      {Array.from({ length: 6 }, (_, row) => (
        <div key={row} className="flex gap-1 mt-2">
          {Array.from({ length: 7 }, (_, col) => (
            <Skeleton key={col} data-testid="calendar-skeleton-cell" className="flex-1 aspect-square rounded-md" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function BookingCalendar({
  availableDates,
  selectedDate,
  onSelect,
  month,
  onMonthChange,
  minMonth,
  maxMonth,
}: Props) {
  const today = React.useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const selected = selectedDate ? new Date(selectedDate + 'T00:00:00') : undefined

  const isDisabled = (date: Date): boolean => {
    return !availableDates!.has(toDateStr(date)) || date < today
  }

  return (
    <div className="relative w-full sm:w-fit">
      {availableDates === null ? (
        <CalendarSkeleton />
      ) : (
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => { if (date) onSelect(toDateStr(date)) }}
          month={month}
          onMonthChange={onMonthChange}
          disabled={isDisabled}
          startMonth={minMonth}
          endMonth={maxMonth}
          showOutsideDays={false}
          classNames={{ root: 'w-full sm:w-fit' }}
        />
      )}
    </div>
  )
}
