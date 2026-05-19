import { headers } from 'next/headers'
import { db } from '@/lib/server/db'
import { withTenantContext } from '@/lib/server/withTenantContext'
import { StaffListPage } from '@/page-components/staff/StaffListPage'

type StaffRow = {
  id: string
  tenant_id: string
  name: string
  email: string | null
  phone: string | null
  is_active: boolean
  location_id: string
  created_at: Date
}

export default async function Page() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')!

  const staff = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<StaffRow>(
      'SELECT id, tenant_id, name, email, phone, is_active, location_id, created_at FROM staff WHERE is_active = true ORDER BY created_at',
    )
    return rows.map(r => ({
      id: r.id,
      tenantId: r.tenant_id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      isActive: r.is_active,
      locationId: r.location_id,
      createdAt: r.created_at.toISOString(),
    }))
  })

  return <StaffListPage initialStaff={staff} />
}
