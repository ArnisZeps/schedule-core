import { Suspense } from 'react'
import { headers } from 'next/headers'
import { dehydrate } from '@tanstack/react-query'
import { db } from '@/lib/server/db'
import { withTenantContext } from '@/lib/server/withTenantContext'
import { makeQueryClient } from '@/lib/server/queryClient'
import { AppointmentsPage } from '@/page-components/appointments/AppointmentsPage'
import type { Booking } from '@/hooks/useBookings'
import type { Staff } from '@/hooks/useStaff'

type ServiceRow = { id: string; tenant_id: string; name: string; description: string | null; duration_minutes: number }
type LocationRow = { id: string; tenant_id: string; name: string; address: string | null; timezone: string; is_active: boolean; created_at: Date }
type StaffRow = { id: string; tenant_id: string; name: string; email: string | null; phone: string | null; is_active: boolean; location_id: string; created_at: Date }
type BookingRow = { id: string; tenant_id: string; service_id: string; location_id: string; staff_id: string | null; staff_name: string | null; client_name: string; client_phone: string; client_email: string | null; start_at: Date; end_at: Date; status: string; notes: string | null; created_at: Date }
type ServiceStaffRow = { service_id: string; id: string; tenant_id: string; name: string; email: string | null; phone: string | null; is_active: boolean; location_id: string; created_at: Date }

function utcWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00.000Z')
  const dow = d.getUTCDay()
  const adj = dow === 0 ? -6 : 1 - dow
  if (adj === 0) return dateStr
  return new Date(d.getTime() + adj * 86400000).toISOString().slice(0, 10)
}

function utcAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00.000Z')
  return new Date(d.getTime() + days * 86400000).toISOString().slice(0, 10)
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; view?: string; date?: string }>
}) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')!
  const sp = await searchParams

  // Derive the booking range to pre-fetch
  const viewParam = sp.view
  let fromDate: string
  let toDate: string

  if (viewParam === 'day') {
    const d = sp.date
    fromDate = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10)
    toDate = utcAddDays(fromDate, 1)
  } else {
    // week view (default)
    const f = sp.from
    fromDate = f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : utcWeekMonday(new Date().toISOString().slice(0, 10))
    toDate = utcAddDays(fromDate, 7)
  }

  const fromISO = fromDate + 'T00:00:00.000Z'
  const toISO = toDate + 'T00:00:00.000Z'

  const [services, locations, staffList, bookings, serviceStaffRows] = await withTenantContext(db, tenantId, async (client) => {
    const [svcRes, locRes, staffRes, bkRes, svcStaffRes] = await Promise.all([
      client.query<ServiceRow>('SELECT id, tenant_id, name, description, duration_minutes FROM services ORDER BY created_at'),
      client.query<LocationRow>('SELECT id, tenant_id, name, address, timezone, is_active, created_at FROM locations ORDER BY created_at'),
      client.query<StaffRow>('SELECT id, tenant_id, name, email, phone, is_active, location_id, created_at FROM staff WHERE is_active = true ORDER BY created_at'),
      client.query<BookingRow>(
        'SELECT b.id, b.tenant_id, b.service_id, b.location_id, b.staff_id, s.name AS staff_name, b.client_name, b.client_phone, b.client_email, b.start_at, b.end_at, b.status, b.notes, b.created_at FROM bookings b LEFT JOIN staff s ON s.id = b.staff_id WHERE b.start_at >= $1 AND b.start_at < $2 ORDER BY b.start_at',
        [fromISO, toISO],
      ),
      client.query<ServiceStaffRow>(
        'SELECT ss.service_id, s.id, s.tenant_id, s.name, s.email, s.phone, s.is_active, s.location_id, s.created_at FROM staff_services ss JOIN staff s ON s.id = ss.staff_id WHERE s.is_active = true ORDER BY s.created_at',
      ),
    ])
    return [svcRes.rows, locRes.rows, staffRes.rows, bkRes.rows, svcStaffRes.rows] as const
  })

  const mappedServices = services.map(r => ({
    id: r.id, tenantId: r.tenant_id, name: r.name,
    description: r.description ?? undefined, durationMinutes: r.duration_minutes,
  }))
  const mappedLocations = locations.map(r => ({
    id: r.id, tenantId: r.tenant_id, name: r.name, address: r.address,
    timezone: r.timezone, isActive: r.is_active, createdAt: r.created_at.toISOString(),
  }))
  const mappedStaff = staffList.map(r => ({
    id: r.id, tenantId: r.tenant_id, name: r.name, email: r.email,
    phone: r.phone, isActive: r.is_active, locationId: r.location_id,
    createdAt: r.created_at.toISOString(),
  }))
  const mappedBookings: Booking[] = bookings.map(r => ({
    id: r.id, tenantId: r.tenant_id, serviceId: r.service_id, locationId: r.location_id,
    staffId: r.staff_id, staffName: r.staff_name, clientName: r.client_name,
    clientPhone: r.client_phone, clientEmail: r.client_email,
    startAt: r.start_at.toISOString(), endAt: r.end_at.toISOString(),
    status: r.status as Booking['status'], notes: r.notes,
    createdAt: r.created_at.toISOString(),
  }))

  const qc = makeQueryClient()
  qc.setQueryData(['bookings', tenantId, { from: fromISO, to: toISO, serviceId: undefined }], mappedBookings)
  qc.setQueryData(['services', tenantId], mappedServices)
  qc.setQueryData(['locations', tenantId, { includeInactive: true }], mappedLocations)
  qc.setQueryData(['staff', tenantId, { includeInactive: false, locationId: undefined }], mappedStaff)

  // Seed service-staff cache for each (serviceId, locationId) pair
  const serviceStaffMap = new Map<string, Staff[]>()
  for (const row of serviceStaffRows) {
    const key = `${row.service_id}:${row.location_id}`
    if (!serviceStaffMap.has(key)) serviceStaffMap.set(key, [])
    serviceStaffMap.get(key)!.push({
      id: row.id, tenantId: row.tenant_id, name: row.name, email: row.email,
      phone: row.phone, isActive: row.is_active, locationId: row.location_id,
      createdAt: row.created_at.toISOString(),
    })
  }
  for (const [key, staff] of serviceStaffMap) {
    const [serviceId, locationId] = key.split(':')
    qc.setQueryData(['service-staff', tenantId, serviceId, locationId], staff)
  }

  return (
    <Suspense fallback={null}>
      <AppointmentsPage dehydratedState={dehydrate(qc)} />
    </Suspense>
  )
}
