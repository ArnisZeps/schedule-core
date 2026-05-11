'use client'

import { CheckCircle } from 'lucide-react'
import type { PublicBookingResult } from '@/hooks/usePublicBooking'

interface Props {
  result: PublicBookingResult
  timezone: string
  onReset: () => void
}

function fmt(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(iso))
}

export function BookingConfirmation({ result, timezone, onReset }: Props) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <CheckCircle className="size-12 text-primary" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Booking confirmed</h1>
        <p className="text-muted-foreground">#{result.id.slice(0, 8)}</p>
      </div>

      <div className="w-full max-w-sm space-y-2 rounded-xl border p-4 text-left text-sm">
        <Row label="Service" value={result.serviceName} />
        {result.staffName && <Row label="Staff" value={result.staffName} />}
        <Row label="Location" value={result.locationName} />
        <Row label="When" value={fmt(result.startAt, timezone)} />
        <Row label="Name" value={result.clientName} />
        <Row label="Phone" value={result.clientPhone} />
      </div>

      <button
        onClick={onReset}
        className="text-sm text-primary underline underline-offset-4 hover:opacity-80"
      >
        Book another appointment
      </button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
