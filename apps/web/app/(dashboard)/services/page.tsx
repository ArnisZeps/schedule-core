import { headers } from 'next/headers'
import { dehydrate } from '@tanstack/react-query'
import { db } from '@/lib/server/db'
import { withTenantContext } from '@/lib/server/withTenantContext'
import { makeQueryClient } from '@/lib/server/queryClient'
import { ServiceListPage } from '@/page-components/services/ServiceListPage'

type ServiceRow = {
  id: string
  tenant_id: string
  name: string
  description: string | null
  duration_minutes: number
}

export default async function Page() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')!

  const services = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<ServiceRow>(
      'SELECT id, tenant_id, name, description, duration_minutes FROM services ORDER BY created_at',
    )
    return rows.map(r => ({
      id: r.id,
      tenantId: r.tenant_id,
      name: r.name,
      description: r.description ?? undefined,
      durationMinutes: r.duration_minutes,
    }))
  })

  const qc = makeQueryClient()
  qc.setQueryData(['services', tenantId], services)

  return <ServiceListPage dehydratedState={dehydrate(qc)} />
}
