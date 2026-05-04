import { useState, useEffect, useRef } from 'react'
import { format, addMinutes } from 'date-fns'
import { X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import type { Service } from '@/hooks/useServices'
import { useServiceSlots } from '@/hooks/useServiceSlots'
import { useCreateBooking } from '@/hooks/useCreateBooking'
import { ApiError } from '@/lib/api'

interface NewAppointmentPanelProps {
  services: Service[]
  prefillStart?: Date
  prefillEnd?: Date
  onClose: () => void
}

export function NewAppointmentPanel({
  services,
  prefillStart,
  prefillEnd,
  onClose,
}: NewAppointmentPanelProps) {
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [date, setDate] = useState(() =>
    prefillStart ? format(prefillStart, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
  )
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string } | null>(
    () => prefillStart && prefillEnd
      ? { startAt: prefillStart.toISOString(), endAt: prefillEnd.toISOString() }
      : null,
  )
  const [override, setOverride] = useState(false)
  const [error, setError] = useState('')
  const prevServiceDateRef = useRef({ serviceId: services[0]?.id ?? '', date: prefillStart ? format(prefillStart, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd') })

  const { data: slots = [], isFetching: slotsFetching } = useServiceSlots(serviceId, date)
  const createBooking = useCreateBooking()

  useEffect(() => {
    if (prevServiceDateRef.current.serviceId !== serviceId || prevServiceDateRef.current.date !== date) {
      prevServiceDateRef.current = { serviceId, date }
      setSelectedSlot(null)
    }
  }, [serviceId, date])

  const selectedService = services.find(s => s.id === serviceId)

  const conflictSlot =
    selectedSlot && slots.find(s => s.startAt === selectedSlot.startAt && !s.available)

  function handleSubmit() {
    setError('')
    if (!clientName.trim()) { setError('Client name is required'); return }
    if (!clientPhone.trim() || clientPhone.length < 7) { setError('Phone must be at least 7 characters'); return }
    if (!selectedSlot) { setError('Please select a time slot'); return }

    createBooking.mutate(
      {
        serviceId,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || undefined,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt,
        notes: notes.trim() || undefined,
        override: override || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Appointment booked')
          onClose()
        },
        onError: err => {
          if (err instanceof ApiError) {
            if (err.status === 409) setError('This slot is taken or outside availability. Enable override to force.')
            else if (err.status === 422) setError('Please check the form fields.')
            else setError(err.message)
          } else {
            setError('Failed to create booking')
          }
        },
      },
    )
  }

  return (
    <div
      className="absolute top-0 right-0 bottom-0 w-96 bg-background border-l shadow-lg flex flex-col z-30"
      data-testid="new-appointment-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <h2 className="text-sm font-semibold">New appointment</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close panel">
          <X className="size-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Client section */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="client-name">Name</Label>
            <Input
              id="client-name"
              placeholder="Client name"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="client-phone">Phone</Label>
            <Input
              id="client-phone"
              placeholder="+1 555 000 0000"
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="client-email">Email (optional)</Label>
            <Input
              id="client-email"
              type="email"
              placeholder="client@example.com"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Service chips */}
        <div className="space-y-1">
          <Label>Service</Label>
          <div className="flex flex-wrap gap-2">
            {services.map(s => (
              <button
                key={s.id}
                type="button"
                data-testid={`service-chip-${s.id}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  serviceId === s.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border hover:bg-muted'
                }`}
                onClick={() => setServiceId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Date row */}
        <div className="space-y-1">
          <Label htmlFor="appt-date">Date</Label>
          <Input
            id="appt-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {/* Slot grid */}
        <div className="space-y-1">
          <Label>Time</Label>
          {slotsFetching ? (
            <p className="text-xs text-muted-foreground">Loading slots...</p>
          ) : slots.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="no-slots-message">
              No availability on this date.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1" data-testid="slot-grid">
              {slots.map(slot => {
                const isSelected = selectedSlot?.startAt === slot.startAt
                return (
                  <button
                    key={slot.startAt}
                    type="button"
                    data-testid={slot.available ? 'slot-available' : 'slot-taken'}
                    className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : slot.available
                        ? 'bg-background border-border hover:bg-muted'
                        : 'bg-muted text-muted-foreground border-border line-through'
                    }`}
                    onClick={() =>
                      setSelectedSlot({ startAt: slot.startAt, endAt: slot.endAt })
                    }
                  >
                    {format(new Date(slot.startAt), 'HH:mm')}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Conflict warning */}
        {conflictSlot && (
          <div
            className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800"
            data-testid="conflict-warning"
          >
            <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
            <span>This slot is already booked. Enable override below to book anyway.</span>
          </div>
        )}

        {/* Override */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="override"
            checked={override}
            onCheckedChange={v => setOverride(v === true)}
            data-testid="override-checkbox"
          />
          <Label htmlFor="override" className="text-sm font-normal cursor-pointer">
            Override availability and conflict checks
          </Label>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="Any notes..."
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t px-4 py-3 space-y-2">
        {error && (
          <p className="text-xs text-destructive" data-testid="panel-error">{error}</p>
        )}
        {selectedSlot && selectedService && (
          <p className="text-xs text-muted-foreground">
            {selectedService.name} · {format(new Date(selectedSlot.startAt), 'MMM d, HH:mm')} –{' '}
            {format(new Date(selectedSlot.endAt), 'HH:mm')}
          </p>
        )}
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={createBooking.isPending}
          data-testid="submit-booking"
        >
          Book appointment
        </Button>
      </div>
    </div>
  )
}
