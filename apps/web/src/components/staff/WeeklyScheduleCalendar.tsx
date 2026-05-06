import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useStaffSchedules, useUpdateStaffSchedules } from '@/hooks/useStaff'
import { Button } from '@/components/ui/button'
import { TimeGutter } from '@/components/calendar/TimeGutter'
import { WeekdayColumn, type LocalWindow } from './WeekdayColumn'
import { ScheduleWindowPanel } from './ScheduleWindowPanel'
import { LoadingState } from '@/components/ui/LoadingState'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

let keyCounter = 0
function nextKey() { return ++keyCounter }

interface PanelState {
  window?: LocalWindow
  dayOfWeek?: number
  prefillStart?: string
  prefillEnd?: string
}

interface WeeklyScheduleCalendarProps {
  staffId: string
}

export function WeeklyScheduleCalendar({ staffId }: WeeklyScheduleCalendarProps) {
  const { data: fetched, isLoading } = useStaffSchedules(staffId)
  const updateMutation = useUpdateStaffSchedules()
  const [windows, setWindows] = useState<LocalWindow[]>([])
  const [panelState, setPanelState] = useState<PanelState | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fetched) {
      setWindows(fetched.map(w => ({ ...w, _key: nextKey() })))
    }
  }, [fetched])

  async function autoSave(list: LocalWindow[]) {
    try {
      await updateMutation.mutateAsync({
        staffId,
        windows: list.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
      })
    } catch {
      toast.error('Failed to save schedule')
    }
  }

  function hasOverlap(list: LocalWindow[], dayOfWeek: number, startTime: string, endTime: string, excludeKey?: number) {
    return list.some(w =>
      w.dayOfWeek === dayOfWeek &&
      w._key !== excludeKey &&
      w.startTime < endTime &&
      startTime < w.endTime
    )
  }

  function handleTimeSelect(dayOfWeek: number, startTime: string, endTime: string) {
    setPanelState({ dayOfWeek, prefillStart: startTime, prefillEnd: endTime })
  }

  function handleBlockClick(win: LocalWindow) {
    setPanelState({ window: win, dayOfWeek: win.dayOfWeek })
  }

  function handlePanelCreate(dayOfWeek: number, startTime: string, endTime: string) {
    if (hasOverlap(windows, dayOfWeek, startTime, endTime)) {
      toast.error('Time window overlaps an existing one')
      return
    }
    const updated = [...windows, { dayOfWeek, startTime, endTime, _key: nextKey() }]
    setWindows(updated)
    setPanelState(null)
    autoSave(updated)
  }

  function handlePanelUpdate(key: number, startTime: string, endTime: string) {
    const target = windows.find(w => w._key === key)
    if (!target) return
    if (hasOverlap(windows, target.dayOfWeek, startTime, endTime, key)) {
      toast.error('Time window overlaps an existing one')
      return
    }
    const updated = windows.map(w => w._key === key ? { ...w, startTime, endTime } : w)
    setWindows(updated)
    setPanelState(null)
    autoSave(updated)
  }

  function handlePanelDelete(key: number) {
    const updated = windows.filter(w => w._key !== key)
    setWindows(updated)
    setPanelState(null)
    autoSave(updated)
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setPanelState({})}>
          Create schedule
        </Button>
      </div>

      <div className="overflow-x-auto">
      <div className="border rounded-lg overflow-hidden" style={{ minWidth: 480 }}>
        <div className="flex border-b bg-muted/40">
          <div className="w-16 flex-shrink-0" />
          {WEEK_ORDER.map(dow => (
            <div key={dow} className="flex-1 text-center py-2 text-xs font-medium text-muted-foreground" style={{ minWidth: 52 }}>
              {DAY_LABELS[dow]}
            </div>
          ))}
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 400 }} ref={scrollRef}>
          <div className="flex">
            <TimeGutter />
            {WEEK_ORDER.map(dow => (
              <WeekdayColumn
                key={dow}
                dayOfWeek={dow}
                windows={windows.filter(w => w.dayOfWeek === dow)}
                onTimeSelect={(start, end) => handleTimeSelect(dow, start, end)}
                onBlockClick={handleBlockClick}
              />
            ))}
          </div>
        </div>
      </div>
      </div>

      {panelState !== null && (
        <ScheduleWindowPanel
          window={panelState.window}
          dayOfWeek={panelState.dayOfWeek}
          prefillStart={panelState.prefillStart}
          prefillEnd={panelState.prefillEnd}
          isPending={updateMutation.isPending}
          onCreate={handlePanelCreate}
          onUpdate={handlePanelUpdate}
          onDelete={handlePanelDelete}
          onClose={() => setPanelState(null)}
        />
      )}
    </div>
  )
}
