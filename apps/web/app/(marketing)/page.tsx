import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'ScheduleCore — Appointment Scheduling for Your Business',
  description: 'ScheduleCore helps businesses manage services, staff, and client bookings in one place.',
  openGraph: {
    title: 'ScheduleCore — Appointment Scheduling for Your Business',
    description: 'ScheduleCore helps businesses manage services, staff, and client bookings in one place.',
    type: 'website',
  },
}

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold text-foreground">ScheduleCore</h1>
        <p className="text-xl text-muted-foreground">
          Appointment scheduling for your business. Manage services, staff, and bookings — all in one place.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
