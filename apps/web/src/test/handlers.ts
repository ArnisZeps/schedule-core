import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const BASE = '/api'

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
    locationId: 'loc-1',
    staffId: null,
    staffName: null,
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
    locationId: 'loc-1',
    staffId: null,
    staffName: null,
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
    locationId: 'loc-1',
    staffId: null,
    staffName: null,
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

export const SERVICE_STAFF = [
  { id: 'staff-1', tenantId: TENANT_ID, name: 'Alice Smith', email: 'alice@example.com', phone: '+1 555 000 0001', isActive: true, locationId: 'loc-1', createdAt: '2026-05-01T00:00:00.000Z' },
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

export const LOCATIONS = [
  { id: 'loc-1', tenantId: TENANT_ID, name: 'Main Branch', address: '123 Main St', timezone: 'Europe/Riga', isActive: true, createdAt: '2026-05-01T00:00:00.000Z' },
  { id: 'loc-2', tenantId: TENANT_ID, name: 'East Branch', address: null, timezone: 'Europe/Riga', isActive: false, createdAt: '2026-05-02T00:00:00.000Z' },
]

export const STAFF = [
  { id: 'staff-1', tenantId: TENANT_ID, name: 'Alice Smith', email: 'alice@example.com', phone: '+1 555 000 0001', isActive: true, locationId: 'loc-1', createdAt: '2026-05-01T00:00:00.000Z' },
  { id: 'staff-2', tenantId: TENANT_ID, name: 'Bob Jones', email: null, phone: null, isActive: false, locationId: 'loc-1', createdAt: '2026-05-02T00:00:00.000Z' },
]

export const STAFF_SCHEDULES = [
  { id: 'sched-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
]

export const STAFF_OVERRIDES = [
  { id: 'ov-1', staffId: 'staff-1', startDate: '2026-07-01', endDate: '2026-07-01', type: 'available', startTime: '09:00', endTime: '17:00', createdAt: '2026-05-01T00:00:00.000Z' },
  { id: 'ov-2', staffId: 'staff-1', startDate: '2026-07-04', endDate: '2026-07-06', type: 'not_available', startTime: '00:00', endTime: '23:59', createdAt: '2026-05-02T00:00:00.000Z' },
]

export const TENANT_SLUG = 'test-biz'

export const PUBLIC_LOCATIONS = [
  { id: 'pub-loc-1', name: 'Main Branch', address: '1 Main St', timezone: 'Europe/Riga' },
  { id: 'pub-loc-2', name: 'East Branch', address: null, timezone: 'Europe/Riga' },
]

export const PUBLIC_SERVICES = [
  { id: 'pub-svc-1', name: 'Haircut', description: 'Classic cut', durationMinutes: 60 },
  { id: 'pub-svc-2', name: 'Shave', description: null, durationMinutes: 30 },
]

export const PUBLIC_STAFF = [
  { id: 'pub-staff-1', name: 'Alice Smith' },
  { id: 'pub-staff-2', name: 'Bob Jones' },
]

export const PUBLIC_SLOTS = [
  { startAt: '2026-05-04T09:00:00.000Z', endAt: '2026-05-04T10:00:00.000Z', available: true },
  { startAt: '2026-05-04T10:00:00.000Z', endAt: '2026-05-04T11:00:00.000Z', available: false },
  { startAt: '2026-05-04T11:00:00.000Z', endAt: '2026-05-04T12:00:00.000Z', available: true },
]

export const PUBLIC_AVAILABLE_DATES = [
  '2026-05-04',
  '2026-05-05',
  '2026-05-06',
  '2026-05-07',
]

function datesInWindow(startDateStr: string, count = 4): string[] {
  const start = new Date(startDateStr + 'T00:00:00')
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

export const PUBLIC_BOOKING_RESULT = {
  id: 'pub-bk-1',
  serviceId: 'pub-svc-1',
  serviceName: 'Haircut',
  staffId: 'pub-staff-1',
  staffName: 'Alice Smith',
  locationId: 'pub-loc-1',
  locationName: 'Main Branch',
  clientName: 'Jane Doe',
  clientPhone: '+371 20000001',
  clientEmail: null,
  startAt: '2026-05-04T09:00:00.000Z',
  endAt: '2026-05-04T10:00:00.000Z',
  status: 'pending',
  createdAt: '2026-05-04T08:00:00.000Z',
}

export const handlers = [
  // ── Public booking API ────────────────────────────────────────────────────

  http.get(`${BASE}/public/:tenantSlug/locations`, () => {
    return HttpResponse.json(PUBLIC_LOCATIONS)
  }),

  http.get(`${BASE}/public/:tenantSlug/services`, () => {
    return HttpResponse.json(PUBLIC_SERVICES)
  }),

  http.get(`${BASE}/public/:tenantSlug/services/:serviceId/staff`, () => {
    return HttpResponse.json(PUBLIC_STAFF)
  }),

  http.get(`${BASE}/public/:tenantSlug/services/:serviceId/slots`, () => {
    return HttpResponse.json(PUBLIC_SLOTS)
  }),

  http.post(`${BASE}/public/:tenantSlug/bookings`, () => {
    return HttpResponse.json(PUBLIC_BOOKING_RESULT, { status: 201 })
  }),

  http.get(`${BASE}/public/:tenantSlug/services/:serviceId/available-dates`, ({ request }) => {
    const startDate = new URL(request.url).searchParams.get('startDate')
    return HttpResponse.json(startDate ? datesInWindow(startDate) : PUBLIC_AVAILABLE_DATES)
  }),

  // ── Locations list
  http.get(`${BASE}/tenants/:tenantId/locations`, ({ request }) => {
    const url = new URL(request.url)
    const includeInactive = url.searchParams.get('includeInactive') === 'true'
    return HttpResponse.json(includeInactive ? LOCATIONS : LOCATIONS.filter(l => l.isActive))
  }),

  // Location create
  http.post(`${BASE}/tenants/:tenantId/locations`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { id: 'loc-new', tenantId: params.tenantId, address: null, isActive: true, createdAt: new Date().toISOString(), ...body },
      { status: 201 },
    )
  }),

  // Location single
  http.get(`${BASE}/tenants/:tenantId/locations/:locationId`, ({ params }) => {
    const loc = LOCATIONS.find(l => l.id === params.locationId)
    if (!loc) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    return HttpResponse.json(loc)
  }),

  // Location update
  http.patch(`${BASE}/tenants/:tenantId/locations/:locationId`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    const loc = LOCATIONS.find(l => l.id === params.locationId) ?? LOCATIONS[0]
    return HttpResponse.json({ ...loc, ...body })
  }),

  // Location delete
  http.delete(`${BASE}/tenants/:tenantId/locations/:locationId`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Auth signup — sets HttpOnly cookie server-side; body no longer contains token
  http.post(`${BASE}/auth/signup`, async () => {
    return HttpResponse.json({ ok: true }, { status: 201 })
  }),

  // Auth login — sets HttpOnly cookie server-side; body no longer contains token
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    if (body.email === 'owner@test.com' && body.password === 'password') {
      return HttpResponse.json({ ok: true })
    }
    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
  }),

  // Auth logout — clears sc_token cookie
  http.post(`${BASE}/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 })
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

  // Service staff (active staff at a location assigned to a service)
  http.get(`${BASE}/tenants/:tenantId/services/:serviceId/staff`, () => {
    return HttpResponse.json(SERVICE_STAFF)
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
    const assignedStaff = SERVICE_STAFF.find(s => s.id === body.staffId) ?? (body.staffId === null ? SERVICE_STAFF[0] : null)
    return HttpResponse.json(
      {
        id: 'bk-new',
        tenantId: params.tenantId,
        serviceId: body.serviceId,
        locationId: body.locationId ?? 'loc-1',
        staffId: assignedStaff?.id ?? null,
        staffName: assignedStaff?.name ?? null,
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

  // Staff list
  http.get(`${BASE}/tenants/:tenantId/staff`, ({ request }) => {
    const url = new URL(request.url)
    const includeInactive = url.searchParams.get('includeInactive') === 'true'
    return HttpResponse.json(includeInactive ? STAFF : STAFF.filter(s => s.isActive))
  }),

  // Staff create
  http.post(`${BASE}/tenants/:tenantId/staff`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { id: 'staff-new', tenantId: params.tenantId, name: body.name, email: body.email ?? null, phone: body.phone ?? null, locationId: body.locationId ?? 'loc-1', isActive: true, createdAt: new Date().toISOString() },
      { status: 201 },
    )
  }),

  // Staff single
  http.get(`${BASE}/tenants/:tenantId/staff/:staffId`, ({ params }) => {
    const member = STAFF.find(s => s.id === params.staffId)
    if (!member) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    return HttpResponse.json(member)
  }),

  // Staff delete
  http.delete(`${BASE}/tenants/:tenantId/staff/:staffId`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Staff patch
  http.patch(`${BASE}/tenants/:tenantId/staff/:staffId`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    const member = STAFF.find(s => s.id === params.staffId) ?? STAFF[0]
    return HttpResponse.json({ ...member, ...body })
  }),

  // Staff services GET
  http.get(`${BASE}/tenants/:tenantId/staff/:staffId/services`, () => {
    return HttpResponse.json([SERVICES[0]])
  }),

  // Staff services PUT
  http.put(`${BASE}/tenants/:tenantId/staff/:staffId/services`, async ({ request }) => {
    const body = await request.json() as { serviceIds: string[] }
    return HttpResponse.json(SERVICES.filter(s => body.serviceIds.includes(s.id)))
  }),

  // Staff schedules GET
  http.get(`${BASE}/tenants/:tenantId/staff/:staffId/schedules`, () => {
    return HttpResponse.json(STAFF_SCHEDULES)
  }),

  // Staff schedules PUT
  http.put(`${BASE}/tenants/:tenantId/staff/:staffId/schedules`, async ({ request }) => {
    const body = await request.json() as { windows: unknown[] }
    return HttpResponse.json(body.windows)
  }),

  // Staff overrides GET
  http.get(`${BASE}/tenants/:tenantId/staff/:staffId/overrides`, () => {
    return HttpResponse.json(STAFF_OVERRIDES)
  }),

  // Staff override create
  http.post(`${BASE}/tenants/:tenantId/staff/:staffId/overrides`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { id: 'ov-new', staffId: params.staffId, ...body, createdAt: new Date().toISOString() },
      { status: 201 },
    )
  }),

  // Staff override update
  http.patch(`${BASE}/tenants/:tenantId/staff/:staffId/overrides/:overrideId`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    const override = STAFF_OVERRIDES.find(o => o.id === params.overrideId) ?? STAFF_OVERRIDES[0]
    return HttpResponse.json({ ...override, ...body })
  }),

  // Staff override delete
  http.delete(`${BASE}/tenants/:tenantId/staff/:staffId/overrides/:overrideId`, () => {
    return new HttpResponse(null, { status: 204 })
  }),
]

export const server = setupServer(...handlers)
