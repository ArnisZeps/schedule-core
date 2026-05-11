import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GET } from '@/app/api/public/[tenantSlug]/locations/route'
import { withClient, insertTenant, insertLocation } from './helpers'

let tenantId: string
const slug = 'test-pub-loc-tenant'
let activeLoc: string
let inactiveLoc: string

beforeAll(async () => {
  await withClient(async (client) => {
    await client.query('BEGIN')
    tenantId = await insertTenant(client, slug)
    activeLoc = await insertLocation(client, tenantId, 'Active Branch')
    const { rows } = await client.query<{ id: string }>(
      "INSERT INTO locations (tenant_id, name, timezone, is_active) VALUES ($1, 'Inactive Branch', 'UTC', false) RETURNING id",
      [tenantId],
    )
    inactiveLoc = rows[0].id
    await client.query('COMMIT')
  })
})

afterAll(async () => {
  await withClient(async (client) => {
    await client.query('DELETE FROM locations WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId])
  })
})

function get(tenantSlug = slug) {
  return GET(new Request(`http://localhost/api/public/${tenantSlug}/locations`), {
    params: Promise.resolve({ tenantSlug }),
  })
}

describe('GET /public/:tenantSlug/locations', () => {
  it('returns active locations only', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    const data = await res.json()
    const ids = data.map((l: { id: string }) => l.id)
    expect(ids).toContain(activeLoc)
    expect(ids).not.toContain(inactiveLoc)
  })

  it('returns id, name, address, timezone — no tenantId or isActive', async () => {
    const res = await get()
    const [loc] = await res.json()
    expect(loc).toHaveProperty('id')
    expect(loc).toHaveProperty('name')
    expect(loc).toHaveProperty('timezone')
    expect(loc).not.toHaveProperty('tenantId')
    expect(loc).not.toHaveProperty('isActive')
  })

  it('returns 404 for unknown slug', async () => {
    const res = await get('unknown-slug-xyz')
    expect(res.status).toBe(404)
  })
})
