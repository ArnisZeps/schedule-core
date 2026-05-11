import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GET } from '@/app/api/tenants/[tenantId]/services/[serviceId]/slots/route'
import {
  withClient, makeToken, makeRequest,
  insertTenant, insertLocation, insertService,
  insertStaff, assignStaffService, insertSchedule, insertBooking,
} from './helpers'

let tenantId: string
let locationId: string
let serviceId: string
let staffId: string
let staffId2: string

// Monday 2026-05-04 — day_of_week = 1
const DATE = '2026-05-04'

beforeAll(async () => {
  await withClient(async (client) => {
    await client.query('BEGIN')
    tenantId = await insertTenant(client, 'test-slots-tenant')
    locationId = await insertLocation(client, tenantId)
    serviceId = await insertService(client, tenantId, 'Haircut', 60)
    staffId = await insertStaff(client, tenantId, locationId, 'Alice')
    staffId2 = await insertStaff(client, tenantId, locationId, 'Bob')
    await assignStaffService(client, staffId, serviceId, tenantId)
    await assignStaffService(client, staffId2, serviceId, tenantId)
    // Schedule: Mon 09:00-11:00 for staffId (produces 09:00 and 10:00 slots)
    await insertSchedule(client, staffId, tenantId, 1, '09:00', '11:00')
    // Schedule: Mon 10:00-12:00 for staffId2 (produces 10:00 and 11:00 slots)
    await insertSchedule(client, staffId2, tenantId, 1, '10:00', '12:00')
    await client.query('COMMIT')
  })
})

afterAll(async () => {
  await withClient(async (client) => {
    await client.query('DELETE FROM bookings WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM staff_schedules WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM staff_services WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM staff WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM services WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM locations WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId])
  })
})

function getSlots(params: { staffId?: string; locationId?: string; date?: string } = {}) {
  const sp = new URLSearchParams({ date: params.date ?? DATE })
  if (params.staffId) sp.set('staffId', params.staffId)
  if (params.locationId) sp.set('locationId', params.locationId)
  const url = `http://localhost/api/tenants/${tenantId}/services/${serviceId}/slots?${sp}`
  return GET(makeRequest(url, makeToken(tenantId)), {
    params: Promise.resolve({ tenantId, serviceId }),
  })
}

describe('GET /tenants/:tenantId/services/:serviceId/slots', () => {
  it('returns 400 when locationId is missing and staffId is absent', async () => {
    const res = await getSlots({ date: DATE })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.param).toBe('locationId')
  })

  it('returns 401 when unauthenticated', async () => {
    const url = `http://localhost/api/tenants/${tenantId}/services/${serviceId}/slots?date=${DATE}&locationId=${locationId}`
    const res = await GET(new Request(url), {
      params: Promise.resolve({ tenantId, serviceId }),
    })
    expect(res.status).toBe(401)
  })

  it('returns staff-schedule-based slots when staffId is provided', async () => {
    const res = await getSlots({ staffId: staffId })
    expect(res.status).toBe(200)
    const slots = await res.json()
    const starts = slots.map((s: { startAt: string }) => s.startAt)
    expect(starts).toContain('2026-05-04T09:00:00.000Z')
    expect(starts).toContain('2026-05-04T10:00:00.000Z')
    // staffId schedule is 09:00-11:00 with 60-min duration → 2 slots
    expect(starts).not.toContain('2026-05-04T11:00:00.000Z')
  })

  it('returns union of all staff slots when locationId provided (any-available)', async () => {
    const res = await getSlots({ locationId })
    expect(res.status).toBe(200)
    const slots = await res.json()
    const starts = slots.map((s: { startAt: string }) => s.startAt)
    // staffId: 09:00, 10:00 | staffId2: 10:00, 11:00 → union: 09:00, 10:00, 11:00
    expect(starts).toContain('2026-05-04T09:00:00.000Z')
    expect(starts).toContain('2026-05-04T10:00:00.000Z')
    expect(starts).toContain('2026-05-04T11:00:00.000Z')
  })

  it('slot is available: false when staff has a booking in that slot', async () => {
    // Book staffId at 09:00 slot
    const bookingId = await withClient(async (client) => {
      return insertBooking(client, tenantId, serviceId, locationId, staffId, '2026-05-04T09:00:00Z', '2026-05-04T10:00:00Z')
    })
    try {
      const res = await getSlots({ staffId })
      const slots = await res.json()
      const slot900 = slots.find((s: { startAt: string }) => s.startAt === '2026-05-04T09:00:00.000Z')
      expect(slot900?.available).toBe(false)
      const slot1000 = slots.find((s: { startAt: string }) => s.startAt === '2026-05-04T10:00:00.000Z')
      expect(slot1000?.available).toBe(true)
    } finally {
      await withClient(async (client) => {
        await client.query('DELETE FROM bookings WHERE id = $1', [bookingId])
      })
    }
  })

  it('any-available slot is false only when ALL qualified staff are booked', async () => {
    // Book both staff at 10:00 slot
    const [bk1, bk2] = await withClient(async (client) => {
      const b1 = await insertBooking(client, tenantId, serviceId, locationId, staffId, '2026-05-04T10:00:00Z', '2026-05-04T11:00:00Z')
      const b2 = await insertBooking(client, tenantId, serviceId, locationId, staffId2, '2026-05-04T10:00:00Z', '2026-05-04T11:00:00Z')
      return [b1, b2]
    })
    try {
      const res = await getSlots({ locationId })
      const slots = await res.json()
      const slot1000 = slots.find((s: { startAt: string }) => s.startAt === '2026-05-04T10:00:00.000Z')
      expect(slot1000?.available).toBe(false)
      // 09:00 only staffId, not booked → available
      const slot900 = slots.find((s: { startAt: string }) => s.startAt === '2026-05-04T09:00:00.000Z')
      expect(slot900?.available).toBe(true)
    } finally {
      await withClient(async (client) => {
        await client.query('DELETE FROM bookings WHERE id IN ($1, $2)', [bk1, bk2])
      })
    }
  })

  it('returns empty array when staff has no schedule for the date', async () => {
    // staffId has schedule on Monday (1); use a Sunday (date with day_of_week=0)
    const sunday = '2026-05-03'
    const res = await getSlots({ staffId, date: sunday })
    expect(res.status).toBe(200)
    const slots = await res.json()
    expect(slots).toHaveLength(0)
  })
})
