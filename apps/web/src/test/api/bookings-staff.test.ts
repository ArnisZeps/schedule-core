import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { POST } from '@/app/api/tenants/[tenantId]/bookings/route'
import {
  withClient, makeToken, makeRequest,
  insertTenant, insertLocation, insertService,
  insertStaff, assignStaffService, insertBooking,
} from './helpers'

let tenantId: string
let locationId: string
let serviceId: string
let activeStaffId: string
let inactiveStaffId: string
let unassignedStaffId: string

beforeAll(async () => {
  await withClient(async (client) => {
    await client.query('BEGIN')
    tenantId = await insertTenant(client, 'test-bk-staff-tenant')
    locationId = await insertLocation(client, tenantId)
    serviceId = await insertService(client, tenantId, 'Haircut', 60)
    activeStaffId = await insertStaff(client, tenantId, locationId, 'Alice Active', true)
    inactiveStaffId = await insertStaff(client, tenantId, locationId, 'Bob Inactive', false)
    unassignedStaffId = await insertStaff(client, tenantId, locationId, 'Carol Unassigned', true)
    await assignStaffService(client, activeStaffId, serviceId, tenantId)
    await assignStaffService(client, inactiveStaffId, serviceId, tenantId)
    // unassignedStaffId intentionally NOT assigned to serviceId
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

function postBooking(body: Record<string, unknown>) {
  const url = `http://localhost/api/tenants/${tenantId}/bookings`
  return POST(
    makeRequest(url, makeToken(tenantId), { method: 'POST', body: JSON.stringify(body) }),
    { params: Promise.resolve({ tenantId }) },
  )
}

const BASE_BODY = {
  serviceId: '',
  locationId: '',
  clientName: 'Test Client',
  clientPhone: '+1 555 000 0000',
  startAt: '2026-06-10T09:00:00.000Z',
  endAt: '2026-06-10T10:00:00.000Z',
}

describe('POST /tenants/:tenantId/bookings — staff assignment', () => {
  it('creates booking with explicit staffId (201 + staffId in response)', async () => {
    const body = { ...BASE_BODY, serviceId, locationId, staffId: activeStaffId }
    const res = await postBooking(body)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.staffId).toBe(activeStaffId)
    expect(data.staffName).toBe('Alice Active')
    await withClient(async (c) => c.query('DELETE FROM bookings WHERE id = $1', [data.id]))
  })

  it('auto-assigns first qualified staff when staffId is null', async () => {
    const body = { ...BASE_BODY, serviceId, locationId, staffId: null,
      startAt: '2026-06-10T11:00:00.000Z', endAt: '2026-06-10T12:00:00.000Z' }
    const res = await postBooking(body)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.staffId).toBe(activeStaffId)
    await withClient(async (c) => c.query('DELETE FROM bookings WHERE id = $1', [data.id]))
  })

  it('returns 422 when staffId is not in staff_services', async () => {
    const body = { ...BASE_BODY, serviceId, locationId, staffId: unassignedStaffId }
    const res = await postBooking(body)
    expect(res.status).toBe(422)
  })

  it('returns 422 when staffId is inactive', async () => {
    const body = { ...BASE_BODY, serviceId, locationId, staffId: inactiveStaffId }
    const res = await postBooking(body)
    expect(res.status).toBe(422)
  })

  it('returns 409 when all qualified staff are booked (auto-assign)', async () => {
    const bookingId = await withClient(async (c) =>
      insertBooking(c, tenantId, serviceId, locationId, activeStaffId, '2026-06-10T13:00:00Z', '2026-06-10T14:00:00Z')
    )
    try {
      const body = { ...BASE_BODY, serviceId, locationId, staffId: null,
        startAt: '2026-06-10T13:00:00.000Z', endAt: '2026-06-10T14:00:00.000Z' }
      const res = await postBooking(body)
      expect(res.status).toBe(409)
    } finally {
      await withClient(async (c) => c.query('DELETE FROM bookings WHERE id = $1', [bookingId]))
    }
  })

  it('override: true with explicit staffId bypasses conflict (201)', async () => {
    const bookingId = await withClient(async (c) =>
      insertBooking(c, tenantId, serviceId, locationId, activeStaffId, '2026-06-10T14:00:00Z', '2026-06-10T15:00:00Z')
    )
    try {
      const body = { ...BASE_BODY, serviceId, locationId, staffId: activeStaffId, override: true,
        startAt: '2026-06-10T14:00:00.000Z', endAt: '2026-06-10T15:00:00.000Z' }
      const res = await postBooking(body)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.staffId).toBe(activeStaffId)
      await withClient(async (c) => c.query('DELETE FROM bookings WHERE id = $1', [data.id]))
    } finally {
      await withClient(async (c) => c.query('DELETE FROM bookings WHERE id = $1', [bookingId]))
    }
  })

  it('override: true with null staffId assigns first staff regardless of conflicts (201)', async () => {
    const bookingId = await withClient(async (c) =>
      insertBooking(c, tenantId, serviceId, locationId, activeStaffId, '2026-06-10T15:00:00Z', '2026-06-10T16:00:00Z')
    )
    try {
      const body = { ...BASE_BODY, serviceId, locationId, staffId: null, override: true,
        startAt: '2026-06-10T15:00:00.000Z', endAt: '2026-06-10T16:00:00.000Z' }
      const res = await postBooking(body)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.staffId).toBe(activeStaffId)
      await withClient(async (c) => c.query('DELETE FROM bookings WHERE id = $1', [data.id]))
    } finally {
      await withClient(async (c) => c.query('DELETE FROM bookings WHERE id = $1', [bookingId]))
    }
  })
})
