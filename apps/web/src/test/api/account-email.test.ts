import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PATCH } from '@/app/api/account/email/route'
import { hashPassword } from '@/lib/server/password'
import { withClient, makeToken, makeRequest, insertTenant, insertUser } from './helpers'

let tenantId: string
let otherTenantId: string
let userId: string

beforeAll(async () => {
  await withClient(async (client) => {
    const hash = await hashPassword('pw-correct')
    tenantId = await insertTenant(client, 'acct-email-tenant')
    otherTenantId = await insertTenant(client, 'acct-email-other-tenant')
    userId = await insertUser(client, tenantId, 'owner@acct.test', hash)
    await insertUser(client, otherTenantId, 'taken@acct.test', hash)
  })
})

afterAll(async () => {
  await withClient(async (client) => {
    await client.query('DELETE FROM users WHERE tenant_id = ANY($1)', [[tenantId, otherTenantId]])
    await client.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantId, otherTenantId]])
  })
})

function patch(body: unknown, token?: string) {
  const url = 'http://localhost/api/account/email'
  if (token === undefined) {
    return PATCH(new Request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))
  }
  return PATCH(makeRequest(url, token, { method: 'PATCH', body: JSON.stringify(body) }))
}

describe('PATCH /api/account/email', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await patch({ email: 'new@acct.test' })
    expect(res.status).toBe(401)
  })

  it('returns 422 for an invalid email', async () => {
    const res = await patch({ email: 'not-an-email' }, makeToken(tenantId, userId))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe('validation_error')
  })

  it('returns 409 when the email is already taken by another user', async () => {
    const res = await patch({ email: 'taken@acct.test' }, makeToken(tenantId, userId))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('email_taken')
  })

  it('changes the email and returns the new value', async () => {
    const res = await patch({ email: 'Changed@Acct.test' }, makeToken(tenantId, userId))
    expect(res.status).toBe(200)
    expect((await res.json()).email).toBe('changed@acct.test')

    const stored = await withClient(async (client) => {
      const { rows } = await client.query('SELECT email FROM users WHERE id = $1', [userId])
      return rows[0].email
    })
    expect(stored).toBe('changed@acct.test')
  })
})
