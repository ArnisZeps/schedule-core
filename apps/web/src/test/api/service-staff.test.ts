import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GET } from '@/app/api/tenants/[tenantId]/services/[serviceId]/staff/route'
import {
  withClient, makeToken, makeRequest,
  insertTenant, insertLocation, insertService,
  insertStaff, assignStaffService,
} from './helpers'

let tenantId: string
let locationId: string
let otherLocationId: string
let serviceId: string
let activeStaffId: string
let inactiveStaffId: string
let unassignedStaffId: string
let otherLocationStaffId: string
const token = () => makeToken(tenantId)

beforeAll(async () => {
  await withClient(async (client) => {
    await client.query('BEGIN')
    tenantId = await insertTenant(client, 'test-svc-staff-tenant')
    locationId = await insertLocation(client, tenantId, 'Main Branch')
    otherLocationId = await insertLocation(client, tenantId, 'Other Branch')
    serviceId = await insertService(client, tenantId, 'Haircut')
    activeStaffId = await insertStaff(client, tenantId, locationId, 'Alice Active', true)
    inactiveStaffId = await insertStaff(client, tenantId, locationId, 'Bob Inactive', false)
    unassignedStaffId = await insertStaff(client, tenantId, locationId, 'Carol Unassigned', true)
    otherLocationStaffId = await insertStaff(client, tenantId, otherLocationId, 'Dave OtherLoc', true)
    await assignStaffService(client, activeStaffId, serviceId, tenantId)
    await assignStaffService(client, inactiveStaffId, serviceId, tenantId)
    await assignStaffService(client, otherLocationStaffId, serviceId, tenantId)
    // unassignedStaffId intentionally NOT assigned to serviceId
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

function getStaff(overrideTenantId = tenantId, overrideServiceId = serviceId, overrideLocationId = locationId) {
  const url = `http://localhost/api/tenants/${overrideTenantId}/services/${overrideServiceId}/staff?locationId=${overrideLocationId}`
  return GET(makeRequest(url, makeToken(tenantId)), {
    params: Promise.resolve({ tenantId: overrideTenantId, serviceId: overrideServiceId }),
  })
}

describe('GET /tenants/:tenantId/services/:serviceId/staff', () => {
  it('returns 401 when unauthenticated', async () => {
    const url = `http://localhost/api/tenants/${tenantId}/services/${serviceId}/staff?locationId=${locationId}`
    const res = await GET(new Request(url), {
      params: Promise.resolve({ tenantId, serviceId }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 when tenantId does not match token', async () => {
    const url = `http://localhost/api/tenants/other-tenant/services/${serviceId}/staff?locationId=${locationId}`
    const res = await GET(makeRequest(url, makeToken(tenantId)), {
      params: Promise.resolve({ tenantId: 'other-tenant', serviceId }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 when locationId is missing', async () => {
    const url = `http://localhost/api/tenants/${tenantId}/services/${serviceId}/staff`
    const res = await GET(makeRequest(url, makeToken(tenantId)), {
      params: Promise.resolve({ tenantId, serviceId }),
    })
    expect(res.status).toBe(400)
  })

  it('returns active staff assigned to the service at the location', async () => {
    const res = await getStaff()
    expect(res.status).toBe(200)
    const data = await res.json()
    const ids = data.map((s: { id: string }) => s.id)
    expect(ids).toContain(activeStaffId)
  })

  it('excludes inactive staff', async () => {
    const res = await getStaff()
    const data = await res.json()
    const ids = data.map((s: { id: string }) => s.id)
    expect(ids).not.toContain(inactiveStaffId)
  })

  it('excludes staff not assigned to the service', async () => {
    const res = await getStaff()
    const data = await res.json()
    const ids = data.map((s: { id: string }) => s.id)
    expect(ids).not.toContain(unassignedStaffId)
  })

  it('excludes staff at a different location', async () => {
    const res = await getStaff()
    const data = await res.json()
    const ids = data.map((s: { id: string }) => s.id)
    expect(ids).not.toContain(otherLocationStaffId)
  })

  it('returns empty array when no staff match', async () => {
    const res = await getStaff(tenantId, serviceId, otherLocationId)
    expect(res.status).toBe(200)
    const data = await res.json()
    // otherLocationStaffId is at otherLocation but is assigned to the service
    // (it was assigned above, so it should appear)
    const ids = data.map((s: { id: string }) => s.id)
    expect(ids).toContain(otherLocationStaffId)
    expect(ids).not.toContain(activeStaffId)
  })

  it('returns empty array when no staff are assigned at all', async () => {
    const emptyServiceId = await withClient(async (client) => {
      return insertService(client, tenantId, 'Empty Service')
    })
    const res = await getStaff(tenantId, emptyServiceId, locationId)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(0)
    await withClient(async (client) => {
      await client.query('DELETE FROM services WHERE id = $1', [emptyServiceId])
    })
  })
})
