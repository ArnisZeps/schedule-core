import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GET } from '@/app/api/public/[tenantSlug]/services/[serviceId]/slots/route'
import {
  withClient, insertTenant, insertLocation, insertService,
  insertStaff, assignStaffService, insertSchedule, insertBooking,
} from './helpers'

let tenantId: string
let locationId: string
let serviceId: string
let staffId: string
const slug = 'test-pub-slots-tenant'
const DATE = '2026-05-04' // Monday (day_of_week = 1)

beforeAll(async () => {
  await withClient(async (client) => {
    await client.query('BEGIN')
    tenantId = await insertTenant(client, slug)
    locationId = await insertLocation(client, tenantId)
    serviceId = await insertService(client, tenantId, 'Haircut', 60)
    staffId = await insertStaff(client, tenantId, locationId, 'Alice')
    await assignStaffService(client, staffId, serviceId, tenantId)
    await insertSchedule(client, staffId, tenantId, 1, '09:00', '11:00')
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

function get(params: { date?: string; locationId?: string; staffId?: string } = {}) {
  const sp = new URLSearchParams()
  if (params.date) sp.set('date', params.date)
  if (params.locationId) sp.set('locationId', params.locationId)
  if (params.staffId) sp.set('staffId', params.staffId)
  const url = `http://localhost/api/public/${slug}/services/${serviceId}/slots?${sp}`
  return GET(new Request(url), {
    params: Promise.resolve({ tenantSlug: slug, serviceId }),
  })
}

describe('GET /public/:tenantSlug/services/:serviceId/slots (public, extended)', () => {
  it('returns 400 when date is missing', async () => {
    const res = await get({ locationId })
    expect(res.status).toBe(400)
  })

  it('returns 400 when both locationId and staffId are absent', async () => {
    const res = await get({ date: DATE })
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown tenant slug', async () => {
    const url = `http://localhost/api/public/unknown-slug/services/${serviceId}/slots?date=${DATE}&locationId=${locationId}`
    const res = await GET(new Request(url), {
      params: Promise.resolve({ tenantSlug: 'unknown-slug', serviceId }),
    })
    expect(res.status).toBe(404)
  })

  it('returns slots for specific staffId', async () => {
    const res = await get({ date: DATE, staffId })
    expect(res.status).toBe(200)
    const slots = await res.json()
    expect(slots.length).toBeGreaterThan(0)
    expect(slots[0]).toHaveProperty('startAt')
    expect(slots[0]).toHaveProperty('endAt')
    expect(slots[0]).toHaveProperty('available')
  })

  it('returns any-available slots when locationId provided', async () => {
    const res = await get({ date: DATE, locationId })
    expect(res.status).toBe(200)
    const slots = await res.json()
    expect(slots.length).toBeGreaterThan(0)
  })

  it('slot is available: false when that staff member is booked at that time', async () => {
    const bookingId = await withClient(async (c) =>
      insertBooking(c, tenantId, serviceId, locationId, staffId, `${DATE}T09:00:00Z`, `${DATE}T10:00:00Z`)
    )
    try {
      const res = await get({ date: DATE, staffId })
      const slots = await res.json()
      const slot = slots.find((s: { startAt: string }) => s.startAt.startsWith(`${DATE}T09`))
      expect(slot?.available).toBe(false)
    } finally {
      await withClient(async (c) => c.query('DELETE FROM bookings WHERE id = $1', [bookingId]))
    }
  })
})
