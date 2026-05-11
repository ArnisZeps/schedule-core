'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

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
}

export function DateStrip({ selectedDate, onSelect }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toDateStr(today)
  const maxOffset = 60

  const [windowStart, setWindowStart] = useState(0)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, windowStart + i)
    return { date: d, str: toDateStr(d) }
  })

  const canPrev = windowStart > 0
  const canNext = windowStart + 7 < maxOffset

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setWindowStart((w) => Math.max(0, w - 7))}
        disabled={!canPrev}
        className="rounded-lg px-2 py-1 text-sm hover:bg-accent disabled:opacity-30"
        aria-label="Previous week"
      >
        &lt;
      </button>

      <div className="flex flex-1 gap-1 overflow-x-auto">
        {days.map(({ date, str }) => {
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
                'flex min-w-[2.75rem] flex-col items-center gap-0.5 rounded-xl border p-2 text-xs transition-colors hover:bg-accent',
                isToday && 'ring-1 ring-primary/40',
                isSelected && 'border-primary bg-accent font-semibold',
              )}
            >
              <span className="text-muted-foreground">{dayName}</span>
              <span>{dayNum}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => setWindowStart((w) => Math.min(maxOffset - 7, w + 7))}
        disabled={!canNext}
        className="rounded-lg px-2 py-1 text-sm hover:bg-accent disabled:opacity-30"
        aria-label="Next week"
      >
        &gt;
      </button>
    </div>
  )
}
