import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { POST } from '@/app/api/public/[tenantSlug]/bookings/route'
import {
  withClient, insertTenant, insertLocation, insertService,
  insertStaff, assignStaffService, insertBooking,
} from './helpers'

let tenantId: string
let locationId: string
let serviceId: string
let staffId: string
const slug = 'test-pub-bk-tenant'

beforeAll(async () => {
  await withClient(async (client) => {
    await client.query('BEGIN')
    tenantId = await insertTenant(client, slug)
    locationId = await insertLocation(client, tenantId)
    serviceId = await insertService(client, tenantId, 'Haircut', 60)
    staffId = await insertStaff(client, tenantId, locationId, 'Alice Active', true)
    await assignStaffService(client, staffId, serviceId, tenantId)
    await client.query('COMMIT')
  })
})

afterAll(async () => {
  await withClient(async (client) => {
    await client.query('DELETE FROM bookings WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM staff_services WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM staff WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM services WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM locations WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId])
  })
})

function post(body: Record<string, unknown>, tenantSlug = slug) {
  return POST(
    new Request(`http://localhost/api/public/${tenantSlug}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ tenantSlug }) },
  )
}

const BASE = {
  clientName: 'Test Client',
  clientPhone: '+1 555 000 0001',
  startAt: '2026-08-10T09:00:00.000Z',
  endAt: '2026-08-10T10:00:00.000Z',
}

describe('POST /public/:tenantSlug/bookings (extended)', () => {
  it('creates booking with explicit staffId — 201, includes serviceName and locationName', async () => {
    const res = await post({ ...BASE, serviceId, locationId, staffId })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.staffId).toBe(staffId)
    expect(data.staffName).toBeTruthy()
    expect(data.serviceName).toBeTruthy()
    expect(data.locationName).toBeTruthy()
    await withClient(async (c) => c.query('DELETE FROM bookings WHERE id = $1', [data.id]))
  })

  it('creates booking with null staffId (auto-assign) — 201', async () => {
    const res = await post({ ...BASE, serviceId, locationId, staffId: null,
      startAt: '2026-08-10T11:00:00.000Z', endAt: '2026-08-10T12:00:00.000Z' })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.staffId).toBe(staffId)
    await withClient(async (c) => c.query('DELETE FROM bookings WHERE id = $1', [data.id]))
  })

  it('returns 409 when explicit staff has an overlapping booking', async () => {
    const bookingId = await withClient(async (c) =>
      insertBooking(c, tenantId, serviceId, locationId, staffId, '2026-08-10T13:00:00Z', '2026-08-10T14:00:00Z')
    )
    try {
      const res = await post({ ...BASE, serviceId, locationId, staffId,
        startAt: '2026-08-10T13:00:00.000Z', endAt: '2026-08-10T14:00:00.000Z' })
      expect(res.status).toBe(409)
    } finally {
      await withClient(async (c) => c.query('DELETE FROM bookings WHERE id = $1', [bookingId]))
    }
  })

  it('returns 409 when auto-assign finds no free staff', async () => {
    const bookingId = await withClient(async (c) =>
      insertBooking(c, tenantId, serviceId, locationId, staffId, '2026-08-10T15:00:00Z', '2026-08-10T16:00:00Z')
    )
    try {
      const res = await post({ ...BASE, serviceId, locationId, staffId: null,
        startAt: '2026-08-10T15:00:00.000Z', endAt: '2026-08-10T16:00:00.000Z' })
      expect(res.status).toBe(409)
    } finally {
      await withClient(async (c) => c.query('DELETE FROM bookings WHERE id = $1', [bookingId]))
    }
  })

  it('returns 422 when clientPhone is missing', async () => {
    const { clientPhone: _p, ...noPhone } = { ...BASE, serviceId, locationId }
    const res = await post(noPhone)
    expect(res.status).toBe(422)
  })

  it('returns 422 when clientPhone is too short (< 7 chars)', async () => {
    const res = await post({ ...BASE, serviceId, locationId, clientPhone: '123' })
    expect(res.status).toBe(422)
  })

  it('returns 422 when locationId is missing', async () => {
    const res = await post({ ...BASE, serviceId })
    expect(res.status).toBe(422)
  })

  it('returns 404 for unknown tenant slug', async () => {
    const res = await post({ ...BASE, serviceId, locationId }, 'unknown-slug-xyz')
    expect(res.status).toBe(404)
  })
})
