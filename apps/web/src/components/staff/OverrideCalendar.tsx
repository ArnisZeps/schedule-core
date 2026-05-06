import { useState, useRef } from 'react'
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addDays,
} from 'date-fns'
import { useStaffOverrides, type ScheduleOverride } from '@/hooks/useStaff'
import { Button } from '@/components/ui/button'
import { TimeGutter } from '@/components/calendar/TimeGutter'
import { OverrideBlock } from './OverrideBlock'
import { OverridePanel } from './OverridePanel'
import { LoadingState } from '@/components/ui/LoadingState'

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

interface PanelState {
  override?: ScheduleOverride
  prefillDate?: string
  prefillStartTime?: string
  prefillEndTime?: string
}

interface OverrideCalendarProps {
  staffId: string
}

export function OverrideCalendar({ staffId }: OverrideCalendarProps) {
  const [dateStr, setDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [panelState, setPanelState] = useState<PanelState | null>(null)

  const weekStart = startOfWeek(parseISO(dateStr), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(parseISO(dateStr), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const from = format(weekStart, 'yyyy-MM-dd')
  const to = format(weekEnd, 'yyyy-MM-dd')

  const { data: overrides = [], isLoading } = useStaffOverrides(staffId, from, to)

  function overridesForDay(dateIso: string): ScheduleOverride[] {
    return overrides.filter(o => o.startDate === dateIso)
  }

  function openBlankPanel() {
    setPanelState({})
  }

  function openEditPanel(override: ScheduleOverride) {
    setPanelState({ override })
  }

  function handleTimeSelect(date: string, startTime: string, endTime: string) {
    setPanelState({ prefillDate: date, prefillStartTime: startTime, prefillEndTime: endTime })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDateStr(format(new Date(), 'yyyy-MM-dd'))}
          >
            Today
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setDateStr(format(subWeeks(parseISO(dateStr), 1), 'yyyy-MM-dd'))}
            aria-label="Previous week"
          >
            ‹
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setDateStr(format(addWeeks(parseISO(dateStr), 1), 'yyyy-MM-dd'))}
            aria-label="Next week"
          >
            ›
          </Button>
          <span className="text-sm font-medium">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </span>
        </div>
        <Button size="sm" onClick={openBlankPanel}>
          Create override
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="flex sticky top-0 bg-background z-10 border-b">
          <div className="w-16 flex-shrink-0" />
          {days.map(day => (
            <div
              key={day.toISOString()}
              className="flex-1 text-center py-2 text-xs font-medium text-muted-foreground"
            >
              {format(day, 'EEE d')}
            </div>
          ))}
        </div>

        {/* Time grid */}
        {isLoading ? (
          <LoadingState />
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
            <div className="flex">
              <TimeGutter />
              {days.map(day => {
                const dateIso = format(day, 'yyyy-MM-dd')
                const dayOverrides = overridesForDay(dateIso)
                return (
                  <OverrideColumn
                    key={dateIso}
                    date={dateIso}
                    overrides={dayOverrides}
                    onTimeSelect={handleTimeSelect}
                    onOverrideClick={openEditPanel}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>

      {panelState !== null && (
        <OverridePanel
          staffId={staffId}
          override={panelState.override}
          prefillDate={panelState.prefillDate}
          prefillStartTime={panelState.prefillStartTime}
          prefillEndTime={panelState.prefillEndTime}
          onClose={() => setPanelState(null)}
        />
      )}
    </div>
  )
}

interface OverrideColumnProps {
  date: string
  overrides: ScheduleOverride[]
  onTimeSelect: (date: string, startTime: string, endTime: string) => void
  onOverrideClick: (override: ScheduleOverride) => void
}

function OverrideColumn({ date, overrides, onTimeSelect, onOverrideClick }: OverrideColumnProps) {
  const colRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startMin: number } | null>(null)
  const [ghost, setGhost] = useState<{ top: number; height: number } | null>(null)

  function getRelativeY(e: MouseEvent | React.MouseEvent): number {
    const rect = colRef.current!.getBoundingClientRect()
    return e.clientY - rect.top
  }

  function handleMouseDown(e: React.MouseEvent) {
    const startMin = snapToSlot(minutesFromTop(getRelativeY(e)))
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
      onTimeSelect(date, minutesToTime(lo), minutesToTime(hi))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={colRef}
      data-testid={`override-col-${date}`}
      className="flex-1 relative border-l select-none cursor-crosshair"
      style={{ height: TOTAL_HEIGHT }}
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

      {overrides.map(o => (
        <OverrideBlock key={o.id} override={o} onClick={onOverrideClick} />
      ))}
    </div>
  )
}
