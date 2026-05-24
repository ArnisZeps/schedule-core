import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import type { Service } from '@/hooks/useServices'
import type { Location } from '@/hooks/useLocations'
import type { Booking } from '@/hooks/useBookings'
import { useServiceSlots } from '@/hooks/useServiceSlots'
import { useServiceStaff } from '@/hooks/useStaff'
import { useCreateBooking } from '@/hooks/useCreateBooking'
import { useRescheduleBooking } from '@/hooks/useBookings'
import { ApiError } from '@/lib/api'

interface NewAppointmentPanelProps {
  services: Service[]
  locations: Location[]
  prefillStart?: Date
  prefillEnd?: Date
  onClose: () => void
  mode?: 'new' | 'reschedule'
  rescheduleBooking?: Booking
}

export function NewAppointmentPanel({
  services,
  locations,
  prefillStart,
  prefillEnd,
  onClose,
  mode = 'new',
  rescheduleBooking,
}: NewAppointmentPanelProps) {
  const isReschedule = mode === 'reschedule' && rescheduleBooking != null

  const [clientName, setClientName] = useState(() =>
    isReschedule ? rescheduleBooking!.clientName : '',
  )
  const [clientPhone, setClientPhone] = useState(() =>
    isReschedule ? rescheduleBooking!.clientPhone : '',
  )
  const [clientEmail, setClientEmail] = useState(() =>
    isReschedule ? (rescheduleBooking!.clientEmail ?? '') : '',
  )
  const [notes, setNotes] = useState('')
  const [serviceId, setServiceId] = useState(() =>
    isReschedule ? rescheduleBooking!.serviceId : (services[0]?.id ?? ''),
  )
  const [locationId, setLocationId] = useState(() =>
    isReschedule ? rescheduleBooking!.locationId : '',
  )
  const [staffSelectValue, setStaffSelectValue] = useState(() =>
    isReschedule ? (rescheduleBooking!.staffId ?? '') : '',
  )
  const [date, setDate] = useState(() => {
    if (isReschedule) return format(new Date(rescheduleBooking!.startAt), 'yyyy-MM-dd')
    return prefillStart ? format(prefillStart, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  })
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string } | null>(
    () => !isReschedule && prefillStart && prefillEnd
      ? { startAt: prefillStart.toISOString(), endAt: prefillEnd.toISOString() }
      : null,
  )
  const [override, setOverride] = useState(false)
  const [error, setError] = useState('')

  // Custom time
  const [customTimeActive, setCustomTimeActive] = useState(false)
  const [customStartTime, setCustomStartTime] = useState('')

  const initialKey = isReschedule
    ? {
        serviceId: rescheduleBooking!.serviceId,
        date: format(new Date(rescheduleBooking!.startAt), 'yyyy-MM-dd'),
        staffSelectValue: rescheduleBooking!.staffId ?? '',
      }
    : {
        serviceId: services[0]?.id ?? '',
        date: prefillStart ? format(prefillStart, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        staffSelectValue: '',
      }
  const prevKeyRef = useRef(initialKey)

  const activeLocations = locations.filter(l => l.isActive)
  const showLocationPicker = activeLocations.length > 1

  useEffect(() => {
    if (isReschedule) return
    if (!showLocationPicker && activeLocations.length === 1) {
      setLocationId(activeLocations[0].id)
    }
  }, [showLocationPicker, activeLocations.length]) // eslint-disable-line

  useEffect(() => {
    if (isReschedule) return
    setStaffSelectValue('')
    setSelectedSlot(null)
  }, [locationId]) // eslint-disable-line

  useEffect(() => {
    const prev = prevKeyRef.current
    if (prev.serviceId !== serviceId || prev.date !== date || prev.staffSelectValue !== staffSelectValue) {
      prevKeyRef.current = { serviceId, date, staffSelectValue }
      setSelectedSlot(null)
    }
  }, [serviceId, date, staffSelectValue])

  // Clear custom time input when toggling off
  function toggleCustomTime() {
    if (customTimeActive) {
      setCustomTimeActive(false)
      setCustomStartTime('')
    } else {
      setCustomTimeActive(true)
    }
  }

  function handleCustomTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (digits.length < 4) {
      setCustomStartTime(digits.length <= 2 ? digits : digits.slice(0, 2) + ':' + digits.slice(2))
      return
    }
    const h = parseInt(digits.slice(0, 2), 10)
    const m = parseInt(digits.slice(2, 4), 10)
    if (h > 23 || m > 59) {
      setCustomStartTime('')
      return
    }
    setCustomStartTime(digits.slice(0, 2) + ':' + digits.slice(2))
  }

  const resolvedStaffId = staffSelectValue || null
  const resolvedLocationId = locationId || null

  const { data: staffList = [] } = useServiceStaff(serviceId || null, resolvedLocationId)
  const { data: slots = [], isFetching: slotsFetching } = useServiceSlots(
    serviceId,
    date,
    resolvedStaffId,
    resolvedLocationId,
  )
  const createBooking = useCreateBooking()
  const rescheduleBookingMutation = useRescheduleBooking()

  const selectedService = services.find(s => s.id === serviceId)
  const conflictSlot = !customTimeActive && selectedSlot && slots.find(s => s.startAt === selectedSlot.startAt && !s.available)

  function computeCustomEndTime(): string {
    if (!customStartTime || !selectedService) return ''
    const [h, m] = customStartTime.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return ''
    const totalEnd = h * 60 + m + selectedService.durationMinutes
    const endH = Math.floor(totalEnd / 60) % 24
    const endM = totalEnd % 60
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  }

  const isPending = isReschedule ? rescheduleBookingMutation.isPending : createBooking.isPending
  const customEndTime = computeCustomEndTime()
  const customTimeValid = customTimeActive ? customStartTime.length === 5 : true

  function buildCustomSlot(): { startAt: string; endAt: string } | null {
    if (!customStartTime || !selectedService) return null
    const startDate = new Date(`${date}T${customStartTime}:00`)
    if (isNaN(startDate.getTime())) return null
    const endDate = new Date(startDate.getTime() + selectedService.durationMinutes * 60000)
    return { startAt: startDate.toISOString(), endAt: endDate.toISOString() }
  }

  function handleSubmit() {
    setError('')

    if (isReschedule) {
      let startAt: string
      let endAt: string
      let useOverride = false
      if (customTimeActive) {
        const customSlot = buildCustomSlot()
        if (!customSlot) { setError('Please enter a valid time'); return }
        startAt = customSlot.startAt
        endAt = customSlot.endAt
        useOverride = true
      } else {
        if (!selectedSlot) { setError('Please select a time slot'); return }
        startAt = selectedSlot.startAt
        endAt = selectedSlot.endAt
      }
      rescheduleBookingMutation.mutate(
        { id: rescheduleBooking!.id, startAt, endAt, ...(useOverride ? { override: true } : {}) },
        {
          onSuccess: () => {
            toast.success('Appointment rescheduled')
            onClose()
          },
          onError: err => {
            if (err instanceof ApiError) {
              if (err.status === 409) setError('This slot is taken. Use custom time with override to force.')
              else if (err.status === 422) setError('Please check the form fields.')
              else setError(err.message)
            } else {
              setError('Failed to reschedule booking')
            }
          },
        },
      )
      return
    }

    // New appointment mode — validate client fields first
    if (!clientName.trim()) { setError('Client name is required'); return }
    if (!clientPhone.trim() || clientPhone.length < 7) { setError('Phone must be at least 7 characters'); return }
    if (showLocationPicker && !locationId) { setError('Please select a location'); return }

    let startAt: string
    let endAt: string
    let useOverride = false
    if (customTimeActive) {
      const customSlot = buildCustomSlot()
      if (!customSlot) { setError('Please enter a valid time'); return }
      startAt = customSlot.startAt
      endAt = customSlot.endAt
      useOverride = true
    } else {
      if (!selectedSlot) { setError('Please select a time slot'); return }
      startAt = selectedSlot.startAt
      endAt = selectedSlot.endAt
      useOverride = override
    }

    createBooking.mutate(
      {
        serviceId,
        locationId: locationId || undefined,
        staffId: resolvedStaffId,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || undefined,
        startAt,
        endAt,
        notes: notes.trim() || undefined,
        override: useOverride || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Appointment booked')
          onClose()
        },
        onError: err => {
          if (err instanceof ApiError) {
            if (err.status === 409) setError('This slot is taken. Enable override to force.')
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
      className="absolute top-0 right-0 bottom-0 w-full md:w-96 bg-background md:border-l shadow-lg flex flex-col z-30"
      data-testid="new-appointment-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <h2 className="text-sm font-semibold" data-testid="panel-title">
          {isReschedule ? 'Reschedule appointment' : 'New appointment'}
        </h2>
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
              readOnly={isReschedule}
              className={isReschedule ? 'bg-muted text-muted-foreground' : undefined}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="client-phone">Phone</Label>
            <Input
              id="client-phone"
              placeholder="+1 555 000 0000"
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              readOnly={isReschedule}
              className={isReschedule ? 'bg-muted text-muted-foreground' : undefined}
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
              readOnly={isReschedule}
              className={isReschedule ? 'bg-muted text-muted-foreground' : undefined}
            />
          </div>
        </div>

        {/* Service chips */}
        <div className="space-y-1">
          <Label>Service</Label>
          <div className={`flex flex-wrap gap-2 ${isReschedule ? 'pointer-events-none opacity-60' : ''}`}>
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

        {/* Location selector (hidden for single-location tenants) */}
        {showLocationPicker && (
          <div className="space-y-1">
            <Label htmlFor="appt-location">Location</Label>
            <select
              id="appt-location"
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              disabled={isReschedule}
              className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ${isReschedule ? 'opacity-60' : ''}`}
            >
              <option value="">Select location</option>
              {activeLocations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Staff dropdown */}
        <div className="space-y-1">
          <Label htmlFor="staff-select">Staff</Label>
          <select
            id="staff-select"
            data-testid="staff-select"
            value={staffSelectValue}
            onChange={e => setStaffSelectValue(e.target.value)}
            disabled={isReschedule}
            className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ${isReschedule ? 'opacity-60' : ''}`}
          >
            <option value="">Any available</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {!isReschedule && staffList.length === 0 && resolvedLocationId && (
            <p className="text-xs text-muted-foreground" data-testid="no-staff-note">
              No staff assigned to this service at this location.
            </p>
          )}
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

        {/* Slot grid (hidden when custom time is active) */}
        {!customTimeActive && (
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
        )}

        {/* Conflict warning (slot grid path only) */}
        {!customTimeActive && conflictSlot && (
          <div
            className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800"
            data-testid="conflict-warning"
          >
            <AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
            <span>This slot is already booked. Enable override below to book anyway.</span>
          </div>
        )}

        {/* Override checkbox (slot grid path, new mode only) */}
        {!customTimeActive && !isReschedule && (
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
        )}

        {/* Custom time section */}
        <div className="space-y-2">
          <button
            type="button"
            data-testid="custom-time-toggle"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
            onClick={toggleCustomTime}
          >
            {customTimeActive ? 'Use slot grid' : 'Use custom time'}
          </button>

          {customTimeActive && (
            <div className="space-y-2 rounded border border-border p-3">
              <div className="space-y-1">
                <Label htmlFor="custom-time">Start time</Label>
                <Input
                  id="custom-time"
                  type="text"
                  placeholder="HH:MM"
                  value={customStartTime}
                  onChange={handleCustomTimeChange}
                  data-testid="custom-time-input"
                />
              </div>
              {customEndTime && (
                <p className="text-xs text-muted-foreground" data-testid="custom-time-end">
                  Ends at {customEndTime}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Notes (new mode only) */}
        {!isReschedule && (
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
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t px-4 py-3 space-y-2">
        {error && (
          <p className="text-xs text-destructive" data-testid="panel-error">{error}</p>
        )}
        {!customTimeActive && selectedSlot && selectedService && (
          <p className="text-xs text-muted-foreground">
            {selectedService.name} · {format(new Date(selectedSlot.startAt), 'MMM d, HH:mm')} –{' '}
            {format(new Date(selectedSlot.endAt), 'HH:mm')}
          </p>
        )}
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={isPending || (customTimeActive && !customTimeValid)}
          data-testid="submit-booking"
        >
          {isReschedule ? 'Reschedule appointment' : 'Book appointment'}
        </Button>
      </div>
    </div>
  )
}
