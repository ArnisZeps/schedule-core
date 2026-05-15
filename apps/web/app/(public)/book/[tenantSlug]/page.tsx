import { notFound } from 'next/navigation'
import { db } from '@/lib/server/db'
import { withTenantContext } from '@/lib/server/withTenantContext'
import { BookingWidget } from '@/page-components/booking/BookingWidget'
import type { PublicLocation, PublicService, PublicStaffMember } from '@/hooks/usePublicBooking'

export default async function BookPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params

  const tenantClient = await db.connect()
  let tenantId: string
  let tenantName: string
  try {
    const { rows } = await tenantClient.query<{ id: string; name: string }>(
      'SELECT id, name FROM tenants WHERE slug = $1',
      [tenantSlug],
    )
    if (rows.length === 0) notFound()
    tenantId = rows[0].id
    tenantName = rows[0].name
  } finally {
    tenantClient.release()
  }

  const [initialLocations, initialServices] = await Promise.all([
    withTenantContext(db, tenantId, async (client) => {
      const { rows } = await client.query<PublicLocation>(
        `SELECT id, name, address, timezone FROM locations WHERE tenant_id = $1 AND is_active = true ORDER BY created_at`,
        [tenantId],
      )
      return rows
    }),
    withTenantContext(db, tenantId, async (client) => {
      const { rows } = await client.query<PublicService>(
        `SELECT id, name, description, duration_minutes AS "durationMinutes"
         FROM services WHERE tenant_id = $1 ORDER BY created_at`,
        [tenantId],
      )
      return rows
    }),
  ])

  // Pre-fetch staff only for single-location tenants (location is known at render time)
  let initialStaffByService: Record<string, PublicStaffMember[]> = {}
  if (initialLocations.length === 1 && initialServices.length > 0) {
    const locationId = initialLocations[0].id
    const serviceIds = initialServices.map((s) => s.id)
    await withTenantContext(db, tenantId, async (client) => {
      const { rows } = await client.query<{ serviceId: string; id: string; name: string }>(
        `SELECT ss.service_id AS "serviceId", s.id, s.name
         FROM staff_services ss
         JOIN staff s ON ss.staff_id = s.id
         WHERE ss.service_id = ANY($1)
           AND s.tenant_id = $2
           AND s.is_active = true
           AND s.location_id = $3
         ORDER BY s.created_at`,
        [serviceIds, tenantId, locationId],
      )
      for (const row of rows) {
        if (!initialStaffByService[row.serviceId]) initialStaffByService[row.serviceId] = []
        initialStaffByService[row.serviceId].push({ id: row.id, name: row.name })
      }
    })
  }

  return (
    <BookingWidget
      tenantSlug={tenantSlug}
      tenantName={tenantName}
      initialLocations={initialLocations}
      initialServices={initialServices}
      initialStaffByService={initialStaffByService}
    />
  )
}
