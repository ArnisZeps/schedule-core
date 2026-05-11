import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GET } from '@/app/api/public/[tenantSlug]/services/[serviceId]/staff/route'
import {
  withClient, insertTenant, insertLocation, insertService,
  insertStaff, assignStaffService,
} from './helpers'

let tenantId: string
let locationId: string
let serviceId: string
let activeStaffId: string
let inactiveStaffId: string
const slug = 'test-pub-staff-tenant'

beforeAll(async () => {
  await withClient(async (client) => {
    await client.query('BEGIN')
    tenantId = await insertTenant(client, slug)
    locationId = await insertLocation(client, tenantId, 'Main Branch')
    serviceId = await insertService(client, tenantId, 'Haircut')
    activeStaffId = await insertStaff(client, tenantId, locationId, 'Alice Active', true)
    inactiveStaffId = await insertStaff(client, tenantId, locationId, 'Bob Inactive', false)
    await assignStaffService(client, activeStaffId, serviceId, tenantId)
    await assignStaffService(client, inactiveStaffId, serviceId, tenantId)
    await client.query('COMMIT')
  })
})

afterAll(async () => {
  await withClient(async (client) => {
    await client.query('DELETE FROM staff_services WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM staff WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM services WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM locations WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId])
  })
})

function get(tenantSlug: string, svcId: string, locId?: string) {
  const url = `http://localhost/api/public/${tenantSlug}/services/${svcId}/staff${locId ? `?locationId=${locId}` : ''}`
  return GET(new Request(url), {
    params: Promise.resolve({ tenantSlug, serviceId: svcId }),
  })
}

describe('GET /public/:tenantSlug/services/:serviceId/staff', () => {
  it('returns active staff assigned to the service at the location', async () => {
    const res = await get(slug, serviceId, locationId)
    expect(res.status).toBe(200)
    const ids = (await res.json()).map((s: { id: string }) => s.id)
    expect(ids).toContain(activeStaffId)
    expect(ids).not.toContain(inactiveStaffId)
  })

  it('returns only id and name — no email or phone', async () => {
    const res = await get(slug, serviceId, locationId)
    const [member] = await res.json()
    expect(member).toHaveProperty('id')
    expect(member).toHaveProperty('name')
    expect(member).not.toHaveProperty('email')
    expect(member).not.toHaveProperty('phone')
  })

  it('returns 422 when locationId is missing', async () => {
    const res = await get(slug, serviceId)
    expect(res.status).toBe(422)
  })

  it('returns 404 for unknown tenant slug', async () => {
    const res = await get('unknown-slug-xyz', serviceId, locationId)
    expect(res.status).toBe(404)
  })

  it('returns 404 for unknown serviceId', async () => {
    const res = await get(slug, '00000000-0000-0000-0000-000000000000', locationId)
    expect(res.status).toBe(404)
  })

  it('returns empty array when no staff qualify', async () => {
    const emptyServiceId = await withClient(async (c) => insertService(c, tenantId, 'Empty Svc'))
    try {
      const res = await get(slug, emptyServiceId, locationId)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    } finally {
      await withClient(async (c) => c.query('DELETE FROM services WHERE id = $1', [emptyServiceId]))
    }
  })
})
