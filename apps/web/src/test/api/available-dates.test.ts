import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GET } from '@/app/api/public/[tenantSlug]/services/[serviceId]/available-dates/route'
import {
  withClient, insertTenant, insertLocation, insertService,
  insertStaff, assignStaffService, insertSchedule,
} from './helpers'

let tenantId: string
let locationId: string
let serviceId: string
let staffId: string
const slug = 'test-avail-dates-tenant'

// 2026-05-04 is Monday (day_of_week = 1), confirmed by public-slots.test.ts
const MON = '2026-05-04'
const SUN = '2026-05-10'

beforeAll(async () => {
  await withClient(async (client) => {
    await client.query('BEGIN')
    tenantId = await insertTenant(client, slug)
    locationId = await insertLocation(client, tenantId)
    serviceId = await insertService(client, tenantId, 'Haircut', 60)
    staffId = await insertStaff(client, tenantId, locationId, 'Alice')
    await assignStaffService(client, staffId, serviceId, tenantId)
    await insertSchedule(client, staffId, tenantId, 1, '09:00', '11:00') // Monday
    await insertSchedule(client, staffId, tenantId, 3, '09:00', '11:00') // Wednesday
    await client.query('COMMIT')
  })
})

afterAll(async () => {
  await withClient(async (client) => {
    await client.query('DELETE FROM staff_schedules WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM staff_services WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM staff WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM services WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM locations WHERE tenant_id = $1', [tenantId])
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId])
  })
})

function get(params: Record<string, string | undefined> = {}) {
  const sp = new URLSearchParams()
  if (params.locationId) sp.set('locationId', params.locationId)
  if (params.staffId) sp.set('staffId', params.staffId)
  if (params.startDate) sp.set('startDate', params.startDate)
  if (params.endDate) sp.set('endDate', params.endDate)
  const url = `http://localhost/api/public/${slug}/services/${serviceId}/available-dates?${sp}`
  return GET(new Request(url), {
    params: Promise.resolve({ tenantSlug: slug, serviceId }),
  })
}

describe('GET /public/:tenantSlug/services/:serviceId/available-dates', () => {
  it('returns 400 when locationId is missing', async () => {
    const res = await get({ startDate: MON, endDate: SUN })
    expect(res.status).toBe(400)
  })

  it('returns 400 when startDate is missing', async () => {
    const res = await get({ locationId, endDate: SUN })
    expect(res.status).toBe(400)
  })

  it('returns 400 when endDate is missing', async () => {
    const res = await get({ locationId, startDate: MON })
    expect(res.status).toBe(400)
  })

  it('returns 400 when window exceeds 14 days', async () => {
    const res = await get({ locationId, startDate: MON, endDate: '2026-05-20' })
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown tenant slug', async () => {
    const sp = new URLSearchParams({ locationId, startDate: MON, endDate: SUN })
    const url = `http://localhost/api/public/unknown-tenant/services/${serviceId}/available-dates?${sp}`
    const res = await GET(new Request(url), {
      params: Promise.resolve({ tenantSlug: 'unknown-tenant', serviceId }),
    })
    expect(res.status).toBe(404)
  })

  it('returns only dates with available slots — staff on Mon and Wed', async () => {
    const res = await get({ locationId, startDate: MON, endDate: SUN })
    expect(res.status).toBe(200)
    const dates = await res.json() as string[]
    expect(dates).toContain('2026-05-04') // Monday  — has schedule
    expect(dates).toContain('2026-05-06') // Wednesday — has schedule
    expect(dates).not.toContain('2026-05-05') // Tuesday
    expect(dates).not.toContain('2026-05-07') // Thursday
    expect(dates).not.toContain('2026-05-08') // Friday
    expect(dates).not.toContain('2026-05-09') // Saturday
    expect(dates).not.toContain('2026-05-10') // Sunday
  })

  it('returns empty array when no dates in window have slots', async () => {
    const res = await get({ locationId, startDate: '2026-05-09', endDate: '2026-05-10' })
    expect(res.status).toBe(200)
    const dates = await res.json() as string[]
    expect(dates).toEqual([])
  })

  it('respects staffId param — only returns dates where that staff has slots', async () => {
    const res = await get({ locationId, staffId, startDate: MON, endDate: SUN })
    expect(res.status).toBe(200)
    const dates = await res.json() as string[]
    expect(dates).toContain('2026-05-04') // Monday
    expect(dates).toContain('2026-05-06') // Wednesday
    expect(dates).not.toContain('2026-05-05') // Tuesday — no schedule
  })
})
