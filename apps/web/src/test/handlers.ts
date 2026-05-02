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

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    if (body.email === 'owner@test.com' && body.password === 'password') {
      return HttpResponse.json({ token: TEST_TOKEN })
    }
    return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
  }),

  // Resources list
  http.get(`${BASE}/tenants/:tenantId/resources`, () => {
    return HttpResponse.json([
      { id: 'res-1', tenantId: TENANT_ID, name: 'Meeting Room A', description: 'Ground floor' },
      { id: 'res-2', tenantId: TENANT_ID, name: 'Staff: Alice', description: 'Senior stylist' },
    ])
  }),

  // Resource create
  http.post(`${BASE}/tenants/:tenantId/resources`, async ({ request }) => {
    const body = await request.json() as { name: string; description?: string }
    return HttpResponse.json(
      { id: 'res-new', tenantId: TENANT_ID, name: body.name, description: body.description ?? '' },
      { status: 201 },
    )
  }),

  // Resource single
  http.get(`${BASE}/tenants/:tenantId/resources/:resourceId`, ({ params }) => {
    return HttpResponse.json({
      id: params.resourceId,
      tenantId: TENANT_ID,
      name: 'Meeting Room A',
      description: 'Ground floor',
    })
  }),

  // Resource update
  http.patch(`${BASE}/tenants/:tenantId/resources/:resourceId`, async ({ params, request }) => {
    const body = await request.json() as { name?: string; description?: string }
    return HttpResponse.json({
      id: params.resourceId,
      tenantId: TENANT_ID,
      name: body.name ?? 'Meeting Room A',
      description: body.description ?? 'Ground floor',
    })
  }),

  // Resource delete
  http.delete(`${BASE}/tenants/:tenantId/resources/:resourceId`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Availability rules list
  http.get(`${BASE}/tenants/:tenantId/resources/:resourceId/availability-rules`, () => {
    return HttpResponse.json([
      { id: 'rule-1', resourceId: 'res-1', dayOfWeek: 0, startTime: '09:00', endTime: '17:00' },
    ])
  }),

  // Availability rule create
  http.post(`${BASE}/tenants/:tenantId/resources/:resourceId/availability-rules`, async ({ request }) => {
    const body = await request.json() as { dayOfWeek: number; startTime: string; endTime: string }
    return HttpResponse.json(
      { id: 'rule-new', resourceId: 'res-1', ...body },
      { status: 201 },
    )
  }),

  // Availability rule delete
  http.delete(
    `${BASE}/tenants/:tenantId/resources/:resourceId/availability-rules/:ruleId`,
    () => new HttpResponse(null, { status: 204 }),
  ),
]

export const server = setupServer(...handlers)
