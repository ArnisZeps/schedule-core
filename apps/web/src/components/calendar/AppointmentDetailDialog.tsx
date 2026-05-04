import { useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { Booking } from '@/hooks/useBookings'
import { useCancelBooking, useRescheduleBooking } from '@/hooks/useBookings'
import type { Service } from '@/hooks/useServices'
import { ApiError } from '@/lib/api'

const STATUS_BADGE: Record<Booking['status'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  confirmed: 'default',
  cancelled: 'secondary',
}

const STATUS_LABEL: Record<Booking['status'], string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}

function toDatetimeLocal(isoStr: string): string {
  const d = new Date(isoStr)
  return format(d, "yyyy-MM-dd'T'HH:mm")
}

interface AppointmentDetailDialogProps {
  booking: Booking
  services: Service[]
  open: boolean
  onClose: () => void
}

export function AppointmentDetailDialog({
  booking,
  services,
  open,
  onClose,
}: AppointmentDetailDialogProps) {
  const [cancelAlertOpen, setCancelAlertOpen] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [rescheduleError, setRescheduleError] = useState('')
  const [newStart, setNewStart] = useState(toDatetimeLocal(booking.startAt))
  const [newEnd, setNewEnd] = useState(toDatetimeLocal(booking.endAt))

  const cancelBooking = useCancelBooking()
  const rescheduleBooking = useRescheduleBooking()

  const service = services.find(s => s.id === booking.serviceId)
  const start = new Date(booking.startAt)
  const end = new Date(booking.endAt)

  function handleConfirmCancel() {
    setCancelError('')
    cancelBooking.mutate(booking.id, {
      onSuccess: () => {
        setCancelAlertOpen(false)
        onClose()
        toast.success('Appointment cancelled')
      },
      onError: err => {
        setCancelAlertOpen(false)
        setCancelError(err instanceof ApiError ? err.message : 'Failed to cancel')
      },
    })
  }

  function handleReschedule() {
    setRescheduleError('')
    const startDate = new Date(newStart)
    const endDate = new Date(newEnd)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setRescheduleError('Please enter valid start and end times')
      return
    }
    if (endDate <= startDate) {
      setRescheduleError('End must be after start')
      return
    }
    rescheduleBooking.mutate(
      {
        id: booking.id,
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
      },
      {
        onSuccess: () => {
          onClose()
          toast.success('Appointment rescheduled')
        },
        onError: err => {
          setRescheduleError(err instanceof ApiError ? err.message : 'Failed to reschedule')
        },
      },
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={open => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment details</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold">{booking.clientName}</p>
              <p className="text-muted-foreground">{booking.clientPhone}</p>
              {booking.clientEmail && (
                <p className="text-muted-foreground">{booking.clientEmail}</p>
              )}
              {booking.notes && (
                <p className="text-muted-foreground italic">{booking.notes}</p>
              )}
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{service?.name ?? booking.serviceId}</span>
              <span>·</span>
              <span>{format(start, 'MMM d, yyyy')}</span>
              <span>·</span>
              <span>
                {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
              </span>
            </div>

            <Badge variant={STATUS_BADGE[booking.status]}>
              {STATUS_LABEL[booking.status]}
            </Badge>
          </div>

          {cancelError && (
            <p className="text-sm text-destructive">{cancelError}</p>
          )}

          {booking.status !== 'cancelled' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setCancelAlertOpen(true)}
            >
              Cancel appointment
            </Button>
          )}

          {/* Reschedule section */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium">Reschedule</p>
            <div className="grid gap-2">
              <div className="space-y-1">
                <Label htmlFor="new-start">New start</Label>
                <Input
                  id="new-start"
                  type="datetime-local"
                  value={newStart}
                  onChange={e => setNewStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-end">New end</Label>
                <Input
                  id="new-end"
                  type="datetime-local"
                  value={newEnd}
                  onChange={e => setNewEnd(e.target.value)}
                />
              </div>
            </div>
            {rescheduleError && (
              <p className="text-sm text-destructive">{rescheduleError}</p>
            )}
            <Button
              size="sm"
              onClick={handleReschedule}
              disabled={rescheduleBooking.isPending}
            >
              Reschedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelAlertOpen} onOpenChange={setCancelAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the appointment for {booking.clientName}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
