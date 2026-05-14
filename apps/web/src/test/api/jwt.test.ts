import { describe, it, expect, afterEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { signToken } from '@/lib/server/jwt'

const THIRTY_DAYS_S = 30 * 24 * 60 * 60

describe('signToken', () => {
  afterEach(() => {
    delete process.env.JWT_EXPIRY
  })

  it('issues a token that expires at least 30 days from now', () => {
    const nowS = Math.floor(Date.now() / 1000)
    const token = signToken({ sub: 'user-1', tenantId: 'tenant-1' })
    const payload = jwt.decode(token) as { exp: number }

    expect(payload.exp).toBeGreaterThanOrEqual(nowS + THIRTY_DAYS_S - 5)
  })

  it('respects JWT_EXPIRY env var when set', () => {
    process.env.JWT_EXPIRY = '1d'
    const ONE_DAY_S = 24 * 60 * 60
    const nowS = Math.floor(Date.now() / 1000)

    const token = signToken({ sub: 'user-1', tenantId: 'tenant-1' })
    const payload = jwt.decode(token) as { exp: number }

    expect(payload.exp).toBeGreaterThanOrEqual(nowS + ONE_DAY_S - 5)
    expect(payload.exp).toBeLessThan(nowS + 2 * ONE_DAY_S)
  })
})
