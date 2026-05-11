import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GET } from '@/app/api/public/[tenantSlug]/services/route'
import { withClient, insertTenant, insertLocation, insertService } from './helpers'

let tenantId: string
let serviceId: string
const slug = 'test-pub-svc-tenant'

beforeAll(async () => {
  await withClient(async (client) => {
    await client.query('BEGIN')
    tenantId = await insertTenant(client, slug)
    await insertLocation(client, tenantId)
    serviceId = await insertService(client, tenantId, 'Haircut', 45)
    await client.query('COMMIT')
  })
})

afterAll(async () => {
  await withClient(async (client) => {
    await client.query('DELETE FROM services WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM locations WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId])
  })
})

function get(tenantSlug = slug) {
  return GET(new Request(`http://localhost/api/public/${tenantSlug}/services`), {
    params: Promise.resolve({ tenantSlug }),
  })
}

describe('GET /public/:tenantSlug/services', () => {
  it('returns services for the tenant', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.some((s: { id: string }) => s.id === serviceId)).toBe(true)
  })

  it('returns id, name, description, durationMinutes — no tenantId', async () => {
    const res = await get()
    const [svc] = await res.json()
    expect(svc).toHaveProperty('id')
    expect(svc).toHaveProperty('name')
    expect(svc).toHaveProperty('durationMinutes')
    expect(svc.durationMinutes).toBe(45)
    expect(svc).not.toHaveProperty('tenantId')
  })

  it('returns 404 for unknown slug', async () => {
    const res = await get('unknown-slug-xyz')
    expect(res.status).toBe(404)
  })

  it('returns empty array when tenant has no services', async () => {
    const emptySlug = 'test-pub-svc-empty'
    const emptyTenantId = await withClient(async (c) => {
      const id = await insertTenant(c, emptySlug)
      await insertLocation(c, id)
      return id
    })
    try {
      const res = await get(emptySlug)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    } finally {
      await withClient(async (c) => {
        await c.query('DELETE FROM locations WHERE tenant_id = $1', [emptyTenantId])
        await c.query('DELETE FROM tenants WHERE id = $1', [emptyTenantId])
      })
    }
  })
})
