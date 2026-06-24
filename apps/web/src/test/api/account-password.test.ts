import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PATCH } from '@/app/api/account/password/route'
import { hashPassword, verifyPassword } from '@/lib/server/password'
import { withClient, makeToken, makeRequest, insertTenant, insertUser } from './helpers'

let tenantId: string
let userId: string

beforeAll(async () => {
  await withClient(async (client) => {
    const hash = await hashPassword('pw-correct')
    tenantId = await insertTenant(client, 'acct-password-tenant')
    userId = await insertUser(client, tenantId, 'pw-owner@acct.test', hash)
  })
})

afterAll(async () => {
  await withClient(async (client) => {
    await client.query('DELETE FROM users WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId])
  })
})

function patch(body: unknown, token?: string) {
  const url = 'http://localhost/api/account/password'
  if (token === undefined) {
    return PATCH(new Request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))
  }
  return PATCH(makeRequest(url, token, { method: 'PATCH', body: JSON.stringify(body) }))
}

describe('PATCH /api/account/password', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await patch({ currentPassword: 'pw-correct', newPassword: 'new-password' })
    expect(res.status).toBe(401)
  })

  it('returns 422 when the new password is too short', async () => {
    const res = await patch({ currentPassword: 'pw-correct', newPassword: 'short' }, makeToken(tenantId, userId))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe('validation_error')
  })

  it('returns 403 when the current password is wrong', async () => {
    const res = await patch({ currentPassword: 'pw-wrong', newPassword: 'new-password' }, makeToken(tenantId, userId))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('invalid_current_password')
  })

  it('changes the password on valid input', async () => {
    const res = await patch({ currentPassword: 'pw-correct', newPassword: 'brand-new-password' }, makeToken(tenantId, userId))
    expect(res.status).toBe(204)

    const hash = await withClient(async (client) => {
      const { rows } = await client.query('SELECT password_hash FROM users WHERE id = $1', [userId])
      return rows[0].password_hash
    })
    expect(await verifyPassword('brand-new-password', hash)).toBe(true)
    expect(await verifyPassword('pw-correct', hash)).toBe(false)
  })
})
