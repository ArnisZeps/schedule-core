import { Suspense } from 'react'
import { headers } from 'next/headers'
import { parseISO, isValid, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { db } from '@/lib/server/db'
import { withTenantContext } from '@/lib/server/withTenantContext'
import { AppointmentsPage, type ServiceStaffEntry } from '@/page-components/appointments/AppointmentsPage'
import type { Booking } from '@/hooks/useBookings'
import type { Staff } from '@/hooks/useStaff'

type ServiceRow = { id: string; tenant_id: string; name: string; description: string | null; duration_minutes: number }
type LocationRow = { id: string; tenant_id: string; name: string; address: string | null; timezone: string; is_active: boolean; created_at: Date }
type StaffRow = { id: string; tenant_id: string; name: string; email: string | null; phone: string | null; is_active: boolean; location_id: string; created_at: Date }
type BookingRow = { id: string; tenant_id: string; service_id: string; location_id: string; staff_id: string | null; staff_name: string | null; client_name: string; client_phone: string; client_email: string | null; start_at: Date; end_at: Date; status: string; notes: string | null; created_at: Date }
type ServiceStaffRow = { service_id: string; id: string; tenant_id: string; name: string; email: string | null; phone: string | null; is_active: boolean; location_id: string; created_at: Date }

function groupServiceStaffRows(rows: ServiceStaffRow[]): ServiceStaffEntry[] {
  const map = new Map<string, ServiceStaffEntry>()
  for (const row of rows) {
    const key = `${row.service_id}:${row.location_id}`
    if (!map.has(key)) map.set(key, { serviceId: row.service_id, locationId: row.location_id, staff: [] })
    const staff: Staff = {
      id: row.id, tenantId: row.tenant_id, name: row.name,
      email: row.email, phone: row.phone, isActive: row.is_active,
      locationId: row.location_id, createdAt: row.created_at.toISOString(),
    }
    map.get(key)!.staff.push(staff)
  }
  return Array.from(map.values())
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; date?: string; view?: string }>
}) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')!

  const sp = await searchParams
  const fromDate = sp.from && isValid(parseISO(sp.from))
    ? parseISO(sp.from)
    : startOfWeek(new Date(), { weekStartsOn: 1 })
  const toDate = sp.to && isValid(parseISO(sp.to))
    ? parseISO(sp.to)
    : endOfWeek(new Date(), { weekStartsOn: 1 })
  const from = fromDate.toISOString()
  const to = addDays(toDate, 1).toISOString()

  const [services, locations, staffList, bookings, serviceStaffRows] = await withTenantContext(db, tenantId, async (client) => {
    const [svcRes, locRes, staffRes, bkRes, svcStaffRes] = await Promise.all([
      client.query<ServiceRow>('SELECT id, tenant_id, name, description, duration_minutes FROM services ORDER BY created_at'),
      client.query<LocationRow>('SELECT id, tenant_id, name, address, timezone, is_active, created_at FROM locations ORDER BY created_at'),
      client.query<StaffRow>('SELECT id, tenant_id, name, email, phone, is_active, location_id, created_at FROM staff WHERE is_active = true ORDER BY created_at'),
      client.query<BookingRow>(
        'SELECT b.id, b.tenant_id, b.service_id, b.location_id, b.staff_id, s.name AS staff_name, b.client_name, b.client_phone, b.client_email, b.start_at, b.end_at, b.status, b.notes, b.created_at FROM bookings b LEFT JOIN staff s ON s.id = b.staff_id WHERE b.start_at >= $1 AND b.start_at <= $2 ORDER BY b.start_at',
        [from, to],
      ),
      client.query<ServiceStaffRow>(
        'SELECT ss.service_id, s.id, s.tenant_id, s.name, s.email, s.phone, s.is_active, s.location_id, s.created_at FROM staff_services ss JOIN staff s ON s.id = ss.staff_id WHERE s.is_active = true ORDER BY s.created_at',
      ),
    ])
    return [svcRes.rows, locRes.rows, staffRes.rows, bkRes.rows, svcStaffRes.rows] as const
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
        initialServiceStaff={groupServiceStaffRows(serviceStaffRows)}
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
