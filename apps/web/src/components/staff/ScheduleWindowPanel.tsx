import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { TimeSelect } from '@/components/ui/TimeSelect'
import type { LocalWindow } from './WeekdayColumn'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const inputCls =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2'

const schema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().min(1, 'Required'),
  endTime: z.string().min(1, 'Required'),
})

type FormValues = z.infer<typeof schema>

interface ScheduleWindowPanelProps {
  window?: LocalWindow
  dayOfWeek?: number
  prefillStart?: string
  prefillEnd?: string
  isPending?: boolean
  onCreate: (dayOfWeek: number, startTime: string, endTime: string) => void
  onUpdate: (key: number, startTime: string, endTime: string) => void
  onDelete: (key: number) => void
  onClose: () => void
}

export function ScheduleWindowPanel({
  window: win,
  dayOfWeek,
  prefillStart,
  prefillEnd,
  isPending,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: ScheduleWindowPanelProps) {
  const isEdit = !!win

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      dayOfWeek: win?.dayOfWeek ?? dayOfWeek ?? ('' as unknown as number),
      startTime: win?.startTime ?? prefillStart ?? '',
      endTime: win?.endTime ?? prefillEnd ?? '',
    },
  })

  useEffect(() => {
    reset({
      dayOfWeek: win?.dayOfWeek ?? dayOfWeek ?? ('' as unknown as number),
      startTime: win?.startTime ?? prefillStart ?? '',
      endTime: win?.endTime ?? prefillEnd ?? '',
    })
  }, [win?._key, dayOfWeek, prefillStart, prefillEnd]) // eslint-disable-line

  function onSubmit(values: FormValues) {
    if (isEdit && win) {
      onUpdate(win._key, values.startTime, values.endTime)
    } else {
      onCreate(values.dayOfWeek, values.startTime, values.endTime)
    }
  }

  return (
    <div
      data-testid="schedule-window-panel"
      className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">
          {isEdit ? `Edit window` : 'New window'}
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 space-y-4">
        {!isEdit && (
          <div className="space-y-1">
            <Label htmlFor="sw-day">Day</Label>
            <select id="sw-day" {...register('dayOfWeek')} className={inputCls}>
              <option value="">Select day…</option>
              {WEEK_ORDER.map(d => (
                <option key={d} value={d}>{DAY_LABELS[d]}</option>
              ))}
            </select>
            {errors.dayOfWeek && <p className="text-xs text-destructive">{errors.dayOfWeek.message}</p>}
          </div>
        )}
        {isEdit && (
          <p className="text-sm text-muted-foreground">{DAY_LABELS[win.dayOfWeek]}</p>
        )}

        <div className="space-y-1">
          <Label htmlFor="sw-startTime">Start time</Label>
          <Controller
            control={control}
            name="startTime"
            render={({ field }) => <TimeSelect id="sw-startTime" value={field.value} onChange={field.onChange} />}
          />
          {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="sw-endTime">End time</Label>
          <Controller
            control={control}
            name="endTime"
            render={({ field }) => <TimeSelect id="sw-endTime" value={field.value} onChange={field.onChange} />}
          />
          {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? 'Saving…' : isEdit ? 'Update' : 'Create schedule'}
          </Button>
          {isEdit && win && (
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={() => onDelete(win._key)}
            >
              Delete
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
