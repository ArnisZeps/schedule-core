import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const BASE = 'http://localhost:3001'

// Minimal JWT with tenantId=tenant-1, userId=user-1, exp=far future
// payload: { sub: 'user-1', tenantId: 'tenant-1', exp: 9999999999 }
export const TEST_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  btoa(JSON.stringify({ sub: 'user-1', tenantId: 'tenant-1', exp: 9999999999 }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') +
  '.signature'

export const TENANT_ID = 'tenant-1'

export const BOOKINGS = [
  {
    id: 'bk-1',
    tenantId: TENANT_ID,
    serviceId: 'res-1',
    clientName: 'Alice Smith',
    clientEmail: 'alice@test.com',
    startAt: '2026-05-04T09:00:00.000Z',
    endAt: '2026-05-04T10:00:00.000Z',
    status: 'pending',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'bk-2',
    tenantId: TENANT_ID,
    serviceId: 'res-2',
    clientName: 'Bob Jones',
    clientEmail: 'bob@test.com',
    startAt: '2026-05-04T14:00:00.000Z',
    endAt: '2026-05-04T14:20:00.000Z',
    status: 'confirmed',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'bk-3',
    tenantId: TENANT_ID,
    serviceId: 'res-1',
    clientName: 'Carol White',
    clientEmail: 'carol@test.com',
    startAt: '2026-05-05T11:00:00.000Z',
    endAt: '2026-05-05T12:00:00.000Z',
    status: 'cancelled',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
]

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    if (body.email === 'owner@test.com' && body.password === 'password') {
      return HttpResponse.json({ token: TEST_TOKEN })
    }
    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
  }),

  // Services list
  http.get(`${BASE}/tenants/:tenantId/services`, () => {
    return HttpResponse.json([
      { id: 'res-1', tenantId: TENANT_ID, name: 'Meeting Room A', description: 'Ground floor' },
      { id: 'res-2', tenantId: TENANT_ID, name: 'Staff: Alice', description: 'Senior stylist' },
    ])
  }),

  // Service create
  http.post(`${BASE}/tenants/:tenantId/services`, async ({ request }) => {
    const body = await request.json() as { name: string; description?: string }
    return HttpResponse.json(
      { id: 'res-new', tenantId: TENANT_ID, name: body.name, description: body.description ?? '' },
      { status: 201 },
    )
  }),

  // Service single
  http.get(`${BASE}/tenants/:tenantId/services/:serviceId`, ({ params }) => {
    return HttpResponse.json({
      id: params.serviceId,
      tenantId: TENANT_ID,
      name: 'Meeting Room A',
      description: 'Ground floor',
    })
  }),

  // Service update
  http.patch(`${BASE}/tenants/:tenantId/services/:serviceId`, async ({ params, request }) => {
    const body = await request.json() as { name?: string; description?: string }
    return HttpResponse.json({
      id: params.serviceId,
      tenantId: TENANT_ID,
      name: body.name ?? 'Meeting Room A',
      description: body.description ?? 'Ground floor',
    })
  }),

  // Service delete
  http.delete(`${BASE}/tenants/:tenantId/services/:serviceId`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Availability rules list
  http.get(`${BASE}/tenants/:tenantId/services/:serviceId/availability-rules`, () => {
    return HttpResponse.json([
      { id: 'rule-1', serviceId: 'res-1', dayOfWeek: 0, startTime: '09:00', endTime: '17:00' },
    ])
  }),

  // Availability rule create
  http.post(`${BASE}/tenants/:tenantId/services/:serviceId/availability-rules`, async ({ request }) => {
    const body = await request.json() as { dayOfWeek: number; startTime: string; endTime: string }
    return HttpResponse.json(
      { id: 'rule-new', serviceId: 'res-1', ...body },
      { status: 201 },
    )
  }),

  // Availability rule delete
  http.delete(
    `${BASE}/tenants/:tenantId/services/:serviceId/availability-rules/:ruleId`,
    () => new HttpResponse(null, { status: 204 }),
  ),

  // Bookings list (ranged or open-ended; optionally filtered by serviceId)
  http.get(`${BASE}/tenants/:tenantId/bookings`, ({ request }) => {
    const url = new URL(request.url)
    const serviceId = url.searchParams.get('serviceId')
    const bookings = serviceId
      ? BOOKINGS.filter(b => b.serviceId === serviceId)
      : BOOKINGS
    return HttpResponse.json(bookings)
  }),

  // Booking cancel or reschedule
  http.patch(`${BASE}/tenants/:tenantId/bookings/:bookingId`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    const booking = BOOKINGS.find(b => b.id === params.bookingId)
    if (!booking) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    return HttpResponse.json({ ...booking, ...body })
  }),
]

export const server = setupServer(...handlers)
