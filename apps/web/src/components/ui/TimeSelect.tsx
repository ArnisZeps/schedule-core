import type { ChangeEvent } from 'react'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

const selectCls =
  'h-8 rounded-lg border border-input bg-transparent px-2 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2'

interface TimeSelectProps {
  id?: string
  value: string
  onChange: (value: string) => void
  className?: string
}

export function TimeSelect({ id, value, onChange, className }: TimeSelectProps) {
  const parts = value ? value.split(':') : []
  const hour = parts[0]?.padStart(2, '0') ?? '00'
  const rawMin = parts[1]?.padStart(2, '0') ?? '00'
  const minute = MINUTES.includes(rawMin) ? rawMin : '00'

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      <select
        id={id}
        data-testid="time-hour-select"
        value={hour}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(`${e.target.value}:${minute}`)}
        className={selectCls}
      >
        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-sm select-none">:</span>
      <select
        data-testid="time-min-select"
        value={minute}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(`${hour}:${e.target.value}`)}
        className={selectCls}
      >
        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  )
}
