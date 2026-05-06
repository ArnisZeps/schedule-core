import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useStaffSchedules, useUpdateStaffSchedules } from '@/hooks/useStaff'
import { Button } from '@/components/ui/button'
import { TimeGutter } from '@/components/calendar/TimeGutter'
import { WeekdayColumn, type LocalWindow } from './WeekdayColumn'
import { LoadingState } from '@/components/ui/LoadingState'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Mon–Sun order: dayOfWeek values 1,2,3,4,5,6,0
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

let keyCounter = 0
function nextKey() { return ++keyCounter }

interface WeeklyScheduleCalendarProps {
  staffId: string
}

export function WeeklyScheduleCalendar({ staffId }: WeeklyScheduleCalendarProps) {
  const { data: fetched, isLoading } = useStaffSchedules(staffId)
  const updateMutation = useUpdateStaffSchedules()
  const [windows, setWindows] = useState<LocalWindow[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fetched) {
      setWindows(fetched.map(w => ({ ...w, _key: nextKey() })))
    }
  }, [fetched])

  function handleCreate(dayOfWeek: number, startTime: string, endTime: string) {
    setWindows(prev => [...prev, { dayOfWeek, startTime, endTime, _key: nextKey() }])
  }

  function handleDelete(key: number) {
    setWindows(prev => prev.filter(w => w._key !== key))
  }

  function handleUpdate(key: number, startTime: string, endTime: string) {
    setWindows(prev => prev.map(w => w._key === key ? { ...w, startTime, endTime } : w))
  }

  async function handleSave() {
    try {
      await updateMutation.mutateAsync({
        staffId,
        windows: windows.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
      })
      toast.success('Schedule saved')
    } catch {
      toast.error('Failed to save schedule')
    }
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Weekly schedule</h3>
        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving…' : 'Save schedule'}
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="flex border-b bg-muted/40">
          <div className="w-16 flex-shrink-0" />
          {WEEK_ORDER.map(dow => (
            <div key={dow} className="flex-1 text-center py-2 text-xs font-medium text-muted-foreground">
              {DAY_LABELS[dow]}
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="overflow-y-auto" style={{ maxHeight: 400 }} ref={scrollRef}>
          <div className="flex">
            <TimeGutter />
            {WEEK_ORDER.map(dow => (
              <WeekdayColumn
                key={dow}
                dayOfWeek={dow}
                windows={windows.filter(w => w.dayOfWeek === dow)}
                onWindowCreate={(start, end) => handleCreate(dow, start, end)}
                onWindowDelete={handleDelete}
                onWindowUpdate={handleUpdate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
