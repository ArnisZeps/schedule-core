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
    clientPhone: '+1 555 000 0001',
    clientEmail: 'alice@test.com',
    startAt: '2026-05-04T09:00:00.000Z',
    endAt: '2026-05-04T10:00:00.000Z',
    status: 'pending',
    notes: null,
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'bk-2',
    tenantId: TENANT_ID,
    serviceId: 'res-2',
    clientName: 'Bob Jones',
    clientPhone: '+1 555 000 0002',
    clientEmail: null,
    startAt: '2026-05-04T14:00:00.000Z',
    endAt: '2026-05-04T14:20:00.000Z',
    status: 'confirmed',
    notes: 'Window seat preferred',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'bk-3',
    tenantId: TENANT_ID,
    serviceId: 'res-1',
    clientName: 'Carol White',
    clientPhone: '+1 555 000 0003',
    clientEmail: 'carol@test.com',
    startAt: '2026-05-05T11:00:00.000Z',
    endAt: '2026-05-05T12:00:00.000Z',
    status: 'cancelled',
    notes: null,
    createdAt: '2026-05-01T00:00:00.000Z',
  },
]

export const SERVICES = [
  { id: 'res-1', tenantId: TENANT_ID, name: 'Meeting Room A', description: 'Ground floor', durationMinutes: 60 },
  { id: 'res-2', tenantId: TENANT_ID, name: 'Staff: Alice', description: 'Senior stylist', durationMinutes: 30 },
]

export const SLOTS = [
  { startAt: '2026-05-04T09:00:00.000Z', endAt: '2026-05-04T10:00:00.000Z', available: false },
  { startAt: '2026-05-04T10:00:00.000Z', endAt: '2026-05-04T11:00:00.000Z', available: true },
  { startAt: '2026-05-04T11:00:00.000Z', endAt: '2026-05-04T12:00:00.000Z', available: true },
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
    return HttpResponse.json(SERVICES)
  }),

  // Service create
  http.post(`${BASE}/tenants/:tenantId/services`, async ({ request }) => {
    const body = await request.json() as { name: string; description?: string; durationMinutes?: number }
    return HttpResponse.json(
      { id: 'res-new', tenantId: TENANT_ID, name: body.name, description: body.description ?? '', durationMinutes: body.durationMinutes ?? 60 },
      { status: 201 },
    )
  }),

  // Service single
  http.get(`${BASE}/tenants/:tenantId/services/:serviceId`, ({ params }) => {
    const svc = SERVICES.find(s => s.id === params.serviceId)
    return HttpResponse.json(svc ?? { id: params.serviceId, tenantId: TENANT_ID, name: 'Meeting Room A', description: 'Ground floor', durationMinutes: 60 })
  }),

  // Service slots
  http.get(`${BASE}/tenants/:tenantId/services/:serviceId/slots`, () => {
    return HttpResponse.json(SLOTS)
  }),

  // Service update
  http.patch(`${BASE}/tenants/:tenantId/services/:serviceId`, async ({ params, request }) => {
    const body = await request.json() as { name?: string; description?: string; durationMinutes?: number }
    return HttpResponse.json({
      id: params.serviceId,
      tenantId: TENANT_ID,
      name: body.name ?? 'Meeting Room A',
      description: body.description ?? 'Ground floor',
      durationMinutes: body.durationMinutes ?? 60,
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

  // Booking create
  http.post(`${BASE}/tenants/:tenantId/bookings`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      {
        id: 'bk-new',
        tenantId: params.tenantId,
        serviceId: body.serviceId,
        clientName: body.clientName,
        clientPhone: body.clientPhone,
        clientEmail: body.clientEmail ?? null,
        startAt: body.startAt,
        endAt: body.endAt,
        status: 'pending',
        notes: body.notes ?? null,
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    )
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
