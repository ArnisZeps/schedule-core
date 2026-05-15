'use client'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function addDays(base: Date, n: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface Props {
  selectedDate: string | null
  onSelect: (date: string) => void
  windowStart: number
  onPrev: () => void
  onNext: () => void
  availableDates: Set<string> | null
}

export function DateStrip({ selectedDate, onSelect, windowStart, onPrev, onNext, availableDates }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toDateStr(today)
  const maxOffset = 60

  const canPrev = windowStart > 0
  const canNext = windowStart + 7 < maxOffset

  const allDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, windowStart + i)
    return { date: d, str: toDateStr(d) }
  })

  const visibleDays = availableDates
    ? allDays.filter(({ str }) => availableDates.has(str))
    : []

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="rounded-lg px-2 py-1 text-sm hover:bg-accent disabled:opacity-30"
        aria-label="Previous week"
      >
        &lt;
      </button>

      <div className="flex flex-1 gap-1">
        {availableDates === null ? (
          <div data-testid="date-strip-skeleton" className="flex flex-1 gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="flex-1 h-12 rounded-xl" />
            ))}
          </div>
        ) : visibleDays.length === 0 ? (
          <p className="flex-1 text-center text-sm text-muted-foreground py-2">
            No available dates in this period
          </p>
        ) : (
          visibleDays.map(({ date, str }) => {
            const isToday = str === todayStr
            const isSelected = str === selectedDate
            const dayName = DAY_ABBR[date.getDay()]
            const dayNum = date.getDate()
            return (
              <button
                key={str}
                onClick={() => onSelect(str)}
                aria-label={`${dayName} ${dayNum}`}
                className={cn(
                  'flex flex-1 min-w-[2.25rem] flex-col items-center gap-0.5 rounded-xl border p-2 text-xs transition-colors hover:bg-accent',
                  isToday && !isSelected && 'border-2 border-primary/60',
                  isToday && isSelected && 'border-2 border-primary',
                  isSelected && 'bg-accent font-semibold',
                  !isToday && isSelected && 'border-primary',
                )}
              >
                <span className="text-muted-foreground">{dayName}</span>
                <span>{dayNum}</span>
              </button>
            )
          })
        )}
      </div>

      <button
        onClick={onNext}
        disabled={!canNext}
        className="rounded-lg px-2 py-1 text-sm hover:bg-accent disabled:opacity-30"
        aria-label="Next week"
      >
        &gt;
      </button>
    </div>
  )
}
