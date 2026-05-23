import { headers } from 'next/headers'
import { dehydrate } from '@tanstack/react-query'
import { db } from '@/lib/server/db'
import { withTenantContext } from '@/lib/server/withTenantContext'
import { makeQueryClient } from '@/lib/server/queryClient'
import { LocationListPage } from '@/page-components/locations/LocationListPage'

type LocationRow = {
  id: string
  tenant_id: string
  name: string
  address: string | null
  timezone: string
  is_active: boolean
  created_at: Date
}

export default async function Page() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')!

  const locations = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<LocationRow>(
      'SELECT id, tenant_id, name, address, timezone, is_active, created_at FROM locations WHERE is_active = true ORDER BY created_at',
    )
    return rows.map(r => ({
      id: r.id,
      tenantId: r.tenant_id,
      name: r.name,
      address: r.address,
      timezone: r.timezone,
      isActive: r.is_active,
      createdAt: r.created_at.toISOString(),
    }))
  })

  const qc = makeQueryClient()
  qc.setQueryData(['locations', tenantId, { includeInactive: false }], locations)

  return <LocationListPage dehydratedState={dehydrate(qc)} />
}
