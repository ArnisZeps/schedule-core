import { notFound } from 'next/navigation'
import { db } from '@/lib/server/db'
import { withTenantContext } from '@/lib/server/withTenantContext'
import { BookingWidget } from '@/page-components/booking/BookingWidget'
import type { PublicLocation } from '@/hooks/usePublicBooking'

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

  const initialLocations = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<PublicLocation>(
      `SELECT id, name, address, timezone FROM locations WHERE tenant_id = $1 AND is_active = true ORDER BY created_at`,
      [tenantId],
    )
    return rows
  })

  return (
    <BookingWidget
      tenantSlug={tenantSlug}
      tenantName={tenantName}
      initialLocations={initialLocations}
    />
  )
}
