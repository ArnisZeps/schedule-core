import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DELETE } from '@/app/api/tenants/[tenantId]/route'
import { hashPassword } from '@/lib/server/password'
import {
  withClient, makeToken, makeRequest,
  insertTenant, insertUser, insertLocation, insertService, insertBooking,
} from './helpers'

let tenantId: string
let userId: string

beforeEach(async () => {
  await withClient(async (client) => {
    const hash = await hashPassword('pw-correct')
    tenantId = await insertTenant(client, `del-tenant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    userId = await insertUser(client, tenantId, `del-${Date.now()}@acct.test`, hash)
    const locationId = await insertLocation(client, tenantId, 'Main')
    const serviceId = await insertService(client, tenantId, 'Haircut')
    await insertBooking(client, tenantId, serviceId, locationId, null,
      '2026-07-01T09:00:00.000Z', '2026-07-01T10:00:00.000Z')
  })
})

afterEach(async () => {
  // Best-effort cleanup if a test did not delete the tenant.
  await withClient(async (client) => {
    await client.query('DELETE FROM bookings WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId])
  })
})

function del(body: unknown, token?: string, paramTenantId = tenantId) {
  const url = `http://localhost/api/tenants/${paramTenantId}`
  const params = Promise.resolve({ tenantId: paramTenantId })
  if (token === undefined) {
    return DELETE(new Request(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }), { params })
  }
  return DELETE(makeRequest(url, token, { method: 'DELETE', body: JSON.stringify(body) }), { params })
}

describe('DELETE /api/tenants/:tenantId', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await del({ password: 'pw-correct' })
    expect(res.status).toBe(401)
  })

  it('returns 403 when the tenantId does not match the token', async () => {
    const res = await del({ password: 'pw-correct' }, makeToken('00000000-0000-0000-0000-000000000000', userId), tenantId)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('forbidden')
  })

  it('returns 403 invalid_password when the password is wrong', async () => {
    const res = await del({ password: 'pw-wrong' }, makeToken(tenantId, userId))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('invalid_password')

    const stillThere = await withClient(async (client) => {
      const { rows } = await client.query('SELECT 1 FROM tenants WHERE id = $1', [tenantId])
      return rows.length
    })
    expect(stillThere).toBe(1)
  })

  it('purges bookings, deletes the tenant, and clears the auth cookie', async () => {
    const res = await del({ password: 'pw-correct' }, makeToken(tenantId, userId))
    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toMatch(/sc_token=;.*Max-Age=0/i)

    const { tenants, bookings } = await withClient(async (client) => {
      const t = await client.query('SELECT 1 FROM tenants WHERE id = $1', [tenantId])
      const b = await client.query('SELECT 1 FROM bookings WHERE tenant_id = $1', [tenantId])
      return { tenants: t.rows.length, bookings: b.rows.length }
    })
    expect(tenants).toBe(0)
    expect(bookings).toBe(0)
  })
})
