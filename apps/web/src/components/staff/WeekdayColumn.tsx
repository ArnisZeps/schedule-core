import { useRef, useState } from 'react'
import type { ScheduleWindowInput } from '@/hooks/useStaff'

const HOUR_PX = 64
const TOTAL_HEIGHT = HOUR_PX * 24
const SLOT_MINUTES = 15

function snapToSlot(minutes: number): number {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES
}

function minutesFromTop(y: number): number {
  return Math.max(0, Math.min(1440, (y / TOTAL_HEIGHT) * 1440))
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export interface LocalWindow extends ScheduleWindowInput {
  _key: number
}

interface WeekdayColumnProps {
  dayOfWeek: number
  windows: LocalWindow[]
  onTimeSelect: (startTime: string, endTime: string) => void
  onBlockClick: (window: LocalWindow) => void
}

interface Ghost {
  top: number
  height: number
}

export function WeekdayColumn({
  dayOfWeek,
  windows,
  onTimeSelect,
  onBlockClick,
}: WeekdayColumnProps) {
  const colRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startMin: number } | null>(null)
  const [ghost, setGhost] = useState<Ghost | null>(null)

  function getRelativeY(e: MouseEvent | React.MouseEvent): number {
    const rect = colRef.current!.getBoundingClientRect()
    return e.clientY - rect.top
  }

  function handleMouseDown(e: React.MouseEvent) {
    const rawMin = minutesFromTop(getRelativeY(e))
    const startMin = snapToSlot(rawMin)
    dragRef.current = { startMin }
    setGhost({ top: (startMin / 60) * HOUR_PX, height: (SLOT_MINUTES / 60) * HOUR_PX })

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const curMin = snapToSlot(minutesFromTop(getRelativeY(ev)))
      const lo = Math.min(dragRef.current.startMin, curMin)
      const hi = Math.max(dragRef.current.startMin, curMin) + SLOT_MINUTES
      setGhost({ top: (lo / 60) * HOUR_PX, height: ((hi - lo) / 60) * HOUR_PX })
    }

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!dragRef.current) return
      const curMin = snapToSlot(minutesFromTop(getRelativeY(ev)))
      const lo = Math.min(dragRef.current.startMin, curMin)
      const hi = Math.max(dragRef.current.startMin, curMin) + SLOT_MINUTES
      dragRef.current = null
      setGhost(null)
      onTimeSelect(minutesToTime(lo), minutesToTime(hi))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={colRef}
      data-testid={`weekday-col-${dayOfWeek}`}
      className="flex-1 relative border-l select-none cursor-crosshair"
      style={{ height: TOTAL_HEIGHT, minWidth: 52 }}
      onMouseDown={handleMouseDown}
    >
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} className="absolute left-0 right-0 border-t border-border/50" style={{ top: i * HOUR_PX }} />
      ))}
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} className="absolute left-0 right-0 border-t border-border/20" style={{ top: i * HOUR_PX + 32 }} />
      ))}

      {ghost && (
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none bg-blue-300/40 border border-blue-400 rounded"
          style={{ top: ghost.top, height: ghost.height }}
        />
      )}

      {windows.map(w => {
        const top = (timeToMinutes(w.startTime) / 60) * HOUR_PX
        const height = ((timeToMinutes(w.endTime) - timeToMinutes(w.startTime)) / 60) * HOUR_PX

        return (
          <div key={w._key} className="absolute left-0 right-0 z-20" style={{ top, height }}>
            <div
              data-testid="schedule-block"
              className="h-full mx-0.5 rounded bg-blue-500/80 text-white text-xs p-1 cursor-pointer overflow-hidden"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => onBlockClick(w)}
            >
              <span>{w.startTime}</span>
              <span className="mx-0.5">–</span>
              <span>{w.endTime}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
