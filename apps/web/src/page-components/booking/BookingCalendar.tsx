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
    if (availableDates === null) return true
    return !availableDates.has(toDateStr(date)) || date < today
  }

  return (
    <div className="relative w-full sm:w-fit">
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
      {availableDates === null && (
        <div
          data-testid="calendar-skeleton"
          className="absolute inset-0 flex flex-col gap-1 p-2 pt-10"
        >
          {Array.from({ length: 6 }, (_, row) => (
            <div key={row} className="flex gap-1">
              {Array.from({ length: 7 }, (_, col) => (
                <Skeleton key={col} className="flex-1 h-8 rounded-md" />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
