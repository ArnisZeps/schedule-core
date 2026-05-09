import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { toast } from 'sonner'
import type { ScheduleOverride } from '@/hooks/useStaff'
import {
  useCreateStaffOverride,
  useUpdateStaffOverride,
  useDeleteStaffOverride,
} from '@/hooks/useStaff'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const inputCls =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2'

const schema = z.object({
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
  type: z.enum(['available', 'not_available']),
  startTime: z.string().min(1, 'Required'),
  endTime: z.string().min(1, 'Required'),
})

type PanelValues = z.infer<typeof schema>

interface OverridePanelProps {
  staffId: string
  override?: ScheduleOverride
  prefillDate?: string
  prefillStartTime?: string
  prefillEndTime?: string
  onClose: () => void
}

export function OverridePanel({
  staffId,
  override,
  prefillDate,
  prefillStartTime,
  prefillEndTime,
  onClose,
}: OverridePanelProps) {
  const isEdit = !!override
  const createMutation = useCreateStaffOverride()
  const updateMutation = useUpdateStaffOverride()
  const deleteMutation = useDeleteStaffOverride()

  const form = useForm<PanelValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      startDate: override?.startDate ?? prefillDate ?? '',
      endDate: override?.endDate ?? prefillDate ?? '',
      type: override?.type ?? ('' as 'available'),
      startTime: override?.startTime ?? prefillStartTime ?? '',
      endTime: override?.endTime ?? prefillEndTime ?? '',
    },
  })

  useEffect(() => {
    form.reset({
      startDate: override?.startDate ?? prefillDate ?? '',
      endDate: override?.endDate ?? prefillDate ?? '',
      type: override?.type ?? ('' as 'available'),
      startTime: override?.startTime ?? prefillStartTime ?? '',
      endTime: override?.endTime ?? prefillEndTime ?? '',
    })
  }, [override?.id, prefillDate, prefillStartTime, prefillEndTime]) // eslint-disable-line

  const { register, handleSubmit, formState: { errors } } = form

  async function onSubmit(values: PanelValues) {
    try {
      if (isEdit && override) {
        await updateMutation.mutateAsync({ staffId, overrideId: override.id, ...values })
        toast.success('Override updated')
      } else {
        await createMutation.mutateAsync({ staffId, ...values })
        toast.success('Override created')
      }
      onClose()
    } catch {
      toast.error('Failed to save override')
    }
  }

  async function handleDelete() {
    if (!override) return
    try {
      await deleteMutation.mutateAsync({ staffId, overrideId: override.id })
      toast.success('Override deleted')
      onClose()
    } catch {
      toast.error('Failed to delete override')
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div
      data-testid="override-panel"
      className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">{isEdit ? 'Edit override' : 'New override'}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="ov-startDate">Start date</Label>
          <input id="ov-startDate" type="date" {...register('startDate')} className={inputCls} />
          {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="ov-endDate">End date</Label>
          <input id="ov-endDate" type="date" {...register('endDate')} className={inputCls} />
          {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
        </div>

        <div className="space-y-1">
          <Label>Type</Label>
          <div className="flex gap-3">
            <label className="flex items-center gap-1 text-sm">
              <input type="radio" value="available" {...register('type')} />
              Available
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="radio" value="not_available" {...register('type')} />
              Not available
            </label>
          </div>
          {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="ov-startTime">Start time</Label>
          <input id="ov-startTime" type="time" {...register('startTime')} className={inputCls} />
          {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="ov-endTime">End time</Label>
          <input id="ov-endTime" type="time" {...register('endTime')} className={inputCls} />
          {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </Button>
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
            >
              {deleteMutation.isPending ? '…' : 'Delete'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
