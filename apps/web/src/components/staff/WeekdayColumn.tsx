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
  onWindowCreate: (startTime: string, endTime: string) => void
  onWindowDelete: (key: number) => void
  onWindowUpdate: (key: number, startTime: string, endTime: string) => void
}

interface Ghost {
  top: number
  height: number
}

export function WeekdayColumn({
  dayOfWeek,
  windows,
  onWindowCreate,
  onWindowDelete,
  onWindowUpdate,
}: WeekdayColumnProps) {
  const colRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startMin: number } | null>(null)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const [activeKey, setActiveKey] = useState<number | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')

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
      onWindowCreate(minutesToTime(lo), minutesToTime(hi))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function openPopover(w: LocalWindow) {
    setActiveKey(w._key)
    setEditStart(w.startTime)
    setEditEnd(w.endTime)
  }

  function closePopover() {
    setActiveKey(null)
  }

  function handleDelete(key: number) {
    onWindowDelete(key)
    closePopover()
  }

  function handleUpdate(key: number) {
    onWindowUpdate(key, editStart, editEnd)
    closePopover()
  }

  return (
    <div
      ref={colRef}
      data-testid={`weekday-col-${dayOfWeek}`}
      className="flex-1 relative border-l select-none cursor-crosshair"
      style={{ height: TOTAL_HEIGHT }}
      onMouseDown={handleMouseDown}
    >
      {/* Hour grid lines */}
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
        const isActive = activeKey === w._key

        return (
          <div key={w._key} className="absolute left-0 right-0 z-20" style={{ top, height }}>
            <div
              data-testid="schedule-block"
              className="h-full mx-0.5 rounded bg-blue-500/80 text-white text-xs p-1 cursor-pointer overflow-hidden"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => openPopover(w)}
            >
              <span>{w.startTime}</span>
              <span className="mx-0.5">–</span>
              <span>{w.endTime}</span>
            </div>

            {isActive && (
              <div
                data-testid="schedule-block-popover"
                className="absolute left-full top-0 ml-1 z-30 w-48 bg-popover border rounded-lg shadow-lg p-3 space-y-2"
                onMouseDown={e => e.stopPropagation()}
              >
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor={`st-${w._key}`}>
                    Start time
                  </label>
                  <input
                    id={`st-${w._key}`}
                    type="time"
                    value={editStart}
                    onChange={e => setEditStart(e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor={`et-${w._key}`}>
                    End time
                  </label>
                  <input
                    id={`et-${w._key}`}
                    type="time"
                    value={editEnd}
                    onChange={e => setEditEnd(e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex gap-1 pt-1">
                  <button
                    className="flex-1 text-xs bg-primary text-primary-foreground rounded px-2 py-1"
                    onClick={() => handleUpdate(w._key)}
                  >
                    Update
                  </button>
                  <button
                    className="flex-1 text-xs bg-destructive text-destructive-foreground rounded px-2 py-1"
                    onClick={() => handleDelete(w._key)}
                  >
                    Delete
                  </button>
                </div>
                <button
                  className="absolute top-1 right-1 text-xs text-muted-foreground"
                  onClick={closePopover}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
