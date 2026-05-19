import { Suspense } from 'react'
import { headers } from 'next/headers'
import { format, parseISO, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { db } from '@/lib/server/db'
import { withTenantContext } from '@/lib/server/withTenantContext'
import { AppointmentsPage } from '@/page-components/appointments/AppointmentsPage'
import type { Booking } from '@/hooks/useBookings'

type ServiceRow = { id: string; tenant_id: string; name: string; description: string | null; duration_minutes: number }
type LocationRow = { id: string; tenant_id: string; name: string; address: string | null; timezone: string; is_active: boolean; created_at: Date }
type StaffRow = { id: string; tenant_id: string; name: string; email: string | null; phone: string | null; is_active: boolean; location_id: string; created_at: Date }
type BookingRow = { id: string; tenant_id: string; service_id: string; location_id: string; staff_id: string | null; staff_name: string | null; client_name: string; client_phone: string; client_email: string | null; start_at: Date; end_at: Date; status: string; notes: string | null; created_at: Date }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>
}) {
  const [h, sp] = await Promise.all([headers(), searchParams])
  const tenantId = h.get('x-tenant-id')!

  const view = sp.view || 'week'
  const dateStr = sp.date || format(new Date(), 'yyyy-MM-dd')
  const date = parseISO(dateStr)
  const from = view === 'week'
    ? startOfWeek(date, { weekStartsOn: 1 }).toISOString()
    : date.toISOString()
  const to = view === 'week'
    ? addDays(endOfWeek(date, { weekStartsOn: 1 }), 1).toISOString()
    : addDays(date, 1).toISOString()

  const [services, locations, staffList, bookings] = await withTenantContext(db, tenantId, async (client) => {
    const [svcRes, locRes, staffRes, bkRes] = await Promise.all([
      client.query<ServiceRow>('SELECT id, tenant_id, name, description, duration_minutes FROM services ORDER BY created_at'),
      client.query<LocationRow>('SELECT id, tenant_id, name, address, timezone, is_active, created_at FROM locations ORDER BY created_at'),
      client.query<StaffRow>('SELECT id, tenant_id, name, email, phone, is_active, location_id, created_at FROM staff WHERE is_active = true ORDER BY created_at'),
      client.query<BookingRow>(
        'SELECT b.id, b.tenant_id, b.service_id, b.location_id, b.staff_id, s.name AS staff_name, b.client_name, b.client_phone, b.client_email, b.start_at, b.end_at, b.status, b.notes, b.created_at FROM bookings b LEFT JOIN staff s ON s.id = b.staff_id WHERE b.start_at >= $1 AND b.start_at <= $2 ORDER BY b.start_at',
        [from, to],
      ),
    ])
    return [svcRes.rows, locRes.rows, staffRes.rows, bkRes.rows] as const
  })

  return (
    <Suspense fallback={null}>
      <AppointmentsPage
        initialServices={services.map(r => ({
          id: r.id,
          tenantId: r.tenant_id,
          name: r.name,
          description: r.description ?? undefined,
          durationMinutes: r.duration_minutes,
        }))}
        initialLocations={locations.map(r => ({
          id: r.id,
          tenantId: r.tenant_id,
          name: r.name,
          address: r.address,
          timezone: r.timezone,
          isActive: r.is_active,
          createdAt: r.created_at.toISOString(),
        }))}
        initialStaff={staffList.map(r => ({
          id: r.id,
          tenantId: r.tenant_id,
          name: r.name,
          email: r.email,
          phone: r.phone,
          isActive: r.is_active,
          locationId: r.location_id,
          createdAt: r.created_at.toISOString(),
        }))}
        initialBookings={bookings.map(r => ({
          id: r.id,
          tenantId: r.tenant_id,
          serviceId: r.service_id,
          locationId: r.location_id,
          staffId: r.staff_id,
          staffName: r.staff_name,
          clientName: r.client_name,
          clientPhone: r.client_phone,
          clientEmail: r.client_email,
          startAt: r.start_at.toISOString(),
          endAt: r.end_at.toISOString(),
          status: r.status as Booking['status'],
          notes: r.notes,
          createdAt: r.created_at.toISOString(),
        }))}
      />
    </Suspense>
  )
}
