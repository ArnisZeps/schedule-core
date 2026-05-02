import request from 'supertest';
import { createDb, type Db } from '@schedule-core/db';
import { app } from '../app.js';
import { withTenantContext } from '../middleware/tenant-context.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');

let pool: Db;
let token: string;
let tenantId: string;
let otherTenantId: string;

function parseJwt(t: string): { sub: string; tenantId: string } {
  return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
}

async function createResource(tid: string, name: string): Promise<string> {
  let id!: string;
  await withTenantContext(pool, tid, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO resources (tenant_id, name) VALUES ($1, $2) RETURNING id',
      [tid, name],
    );
    id = rows[0].id;
  });
  return id;
}

async function createRule(
  tid: string,
  rid: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): Promise<void> {
  await withTenantContext(pool, tid, async (client) => {
    await client.query(
      'INSERT INTO availability_rules (tenant_id, resource_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4, $5)',
      [tid, rid, dayOfWeek, startTime, endTime],
    );
  });
}

async function createBooking(
  tid: string,
  rid: string,
  startAt: string,
  endAt: string,
  status = 'pending',
): Promise<string> {
  let id!: string;
  await withTenantContext(pool, tid, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO bookings (tenant_id, resource_id, client_name, client_email, start_at, end_at, status)
       VALUES ($1, $2, 'Seed Client', 'seed@example.com', $3, $4, $5) RETURNING id`,
      [tid, rid, startAt, endAt, status],
    );
    id = rows[0].id;
  });
  return id;
}

// 2026-05-04 is a Monday (day_of_week = 1)
const MON1 = '2026-05-04';
// 2026-06-01 is also a Monday — used for reschedule tests to avoid slot conflicts
const MON2 = '2026-06-01';

beforeAll(async () => {
  process.env.JWT_SECRET = 'a'.repeat(32);
  pool = createDb();
  await pool.query('TRUNCATE bookings, availability_rules, resources, users, tenants CASCADE');

  const res1 = await request(app).post('/auth/signup').send({
    email: 'bookings-owner@example.com',
    password: 'password123',
    businessName: 'Bookings Biz',
    slug: 'bookings-biz',
  });
  token = res1.body.token;
  tenantId = parseJwt(token).tenantId;

  const res2 = await request(app).post('/auth/signup').send({
    email: 'bookings-other@example.com',
    password: 'password123',
    businessName: 'Other Bookings Biz',
    slug: 'other-bookings-biz',
  });
  otherTenantId = parseJwt(res2.body.token).tenantId;
});

afterAll(async () => {
  await pool.query('TRUNCATE bookings, availability_rules, resources, users, tenants CASCADE');
  await pool.end();
  delete process.env.JWT_SECRET;
});

// ---------------------------------------------------------------------------
// GET /tenants/:id/bookings
// ---------------------------------------------------------------------------

describe('GET /tenants/:id/bookings', () => {
  let resourceId: string;

  beforeAll(async () => {
    resourceId = await createResource(tenantId, 'List Bookings Resource');
    // Monday rule — enables availability-checked creates later
    await createRule(tenantId, resourceId, 1, '09:00', '17:00');
    // Seed three bookings
    await createBooking(tenantId, resourceId, `${MON1}T09:00:00Z`, `${MON1}T10:00:00Z`);
    await createBooking(tenantId, resourceId, `${MON1}T10:00:00Z`, `${MON1}T11:00:00Z`);
    await createBooking(tenantId, resourceId, '2026-05-05T09:00:00Z', '2026-05-05T10:00:00Z');
  });

  it('200 — returns all bookings sorted by start_at ascending', async () => {
    const res = await request(app)
      .get(`/tenants/${tenantId}/bookings`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < res.body.length; i++) {
      expect(new Date(res.body[i].startAt) >= new Date(res.body[i - 1].startAt)).toBe(true);
    }
  }, 15_000);

  it('200 — from/to filter returns only bookings within the range', async () => {
    const res = await request(app)
      .get(`/tenants/${tenantId}/bookings?from=${MON1}T00:00:00Z&to=${MON1}T23:59:59Z`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body.every((b: { startAt: string }) => b.startAt.startsWith(MON1))).toBe(true);
  }, 15_000);

  it('200 — resourceId filter returns only bookings for that resource', async () => {
    const otherResourceId = await createResource(tenantId, 'Other Resource');
    await createBooking(tenantId, otherResourceId, '2026-05-11T09:00:00Z', '2026-05-11T10:00:00Z');

    const res = await request(app)
      .get(`/tenants/${tenantId}/bookings?resourceId=${resourceId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((b: { resourceId: string }) => b.resourceId === resourceId)).toBe(true);
  }, 15_000);

  it('200 — status=active excludes cancelled bookings', async () => {
    const cancelledId = await createBooking(tenantId, resourceId, '2026-05-18T09:00:00Z', '2026-05-18T10:00:00Z', 'cancelled');

    const allRes = await request(app)
      .get(`/tenants/${tenantId}/bookings`)
      .set('Authorization', `Bearer ${token}`);
    const activeRes = await request(app)
      .get(`/tenants/${tenantId}/bookings?status=active`)
      .set('Authorization', `Bearer ${token}`);

    expect(activeRes.status).toBe(200);
    expect(activeRes.body.every((b: { status: string }) => b.status !== 'cancelled')).toBe(true);
    expect(allRes.body.some((b: { id: string }) => b.id === cancelledId)).toBe(true);
    expect(activeRes.body.some((b: { id: string }) => b.id === cancelledId)).toBe(false);
  }, 15_000);

  it('400 — invalid ISO 8601 from param', async () => {
    const res = await request(app)
      .get(`/tenants/${tenantId}/bookings?from=not-a-date`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  }, 15_000);

  it('400 — invalid ISO 8601 to param', async () => {
    const res = await request(app)
      .get(`/tenants/${tenantId}/bookings?to=bad-date`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .get(`/tenants/${otherTenantId}/bookings`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// POST /tenants/:id/bookings
// ---------------------------------------------------------------------------

describe('POST /tenants/:id/bookings', () => {
  let resourceId: string;

  beforeAll(async () => {
    resourceId = await createResource(tenantId, 'Create Booking Resource');
    await createRule(tenantId, resourceId, 1, '09:00', '17:00');
  });

  it('201 — creates booking with status pending', async () => {
    const res = await request(app)
      .post(`/tenants/${tenantId}/bookings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        resourceId,
        clientName: 'Alice',
        clientEmail: 'alice@example.com',
        startAt: `${MON1}T09:00:00Z`,
        endAt: `${MON1}T10:00:00Z`,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      tenantId,
      resourceId,
      clientName: 'Alice',
      clientEmail: 'alice@example.com',
      status: 'pending',
    });
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.createdAt).toBe('string');
  }, 15_000);

  it('409 — overlap with existing non-cancelled booking', async () => {
    // booking at 09:00-10:00 already exists from the previous test
    const res = await request(app)
      .post(`/tenants/${tenantId}/bookings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        resourceId,
        clientName: 'Bob',
        clientEmail: 'bob@example.com',
        startAt: `${MON1}T09:30:00Z`,
        endAt: `${MON1}T10:30:00Z`,
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'overlap' });
  }, 15_000);

  it('409 — slot outside availability rules', async () => {
    const res = await request(app)
      .post(`/tenants/${tenantId}/bookings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        resourceId,
        clientName: 'Charlie',
        clientEmail: 'charlie@example.com',
        startAt: `${MON1}T18:00:00Z`,
        endAt: `${MON1}T19:00:00Z`,
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'outside_availability' });
  }, 15_000);

  it('422 — missing required field (clientEmail)', async () => {
    const res = await request(app)
      .post(`/tenants/${tenantId}/bookings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        resourceId,
        clientName: 'Dave',
        startAt: `${MON1}T14:00:00Z`,
        endAt: `${MON1}T15:00:00Z`,
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);

  it('422 — startAt >= endAt', async () => {
    const res = await request(app)
      .post(`/tenants/${tenantId}/bookings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        resourceId,
        clientName: 'Eve',
        clientEmail: 'eve@example.com',
        startAt: `${MON1}T15:00:00Z`,
        endAt: `${MON1}T14:00:00Z`,
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .post(`/tenants/${otherTenantId}/bookings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        resourceId,
        clientName: 'Frank',
        clientEmail: 'frank@example.com',
        startAt: `${MON1}T13:00:00Z`,
        endAt: `${MON1}T14:00:00Z`,
      });

    expect(res.status).toBe(403);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// PATCH /tenants/:id/bookings/:id — cancel
// ---------------------------------------------------------------------------

describe('PATCH /tenants/:id/bookings/:id — cancel', () => {
  let resourceId: string;

  beforeAll(async () => {
    resourceId = await createResource(tenantId, 'Cancel Booking Resource');
    await createRule(tenantId, resourceId, 1, '09:00', '17:00');
  });

  it('200 — cancels a pending booking', async () => {
    const bookingId = await createBooking(tenantId, resourceId, `${MON1}T09:00:00Z`, `${MON1}T10:00:00Z`);

    const res = await request(app)
      .patch(`/tenants/${tenantId}/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.id).toBe(bookingId);
  }, 15_000);

  it('409 — already_cancelled when cancelling a cancelled booking', async () => {
    const bookingId = await createBooking(
      tenantId, resourceId, '2026-05-11T09:00:00Z', '2026-05-11T10:00:00Z', 'cancelled',
    );

    const res = await request(app)
      .patch(`/tenants/${tenantId}/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'already_cancelled' });
  }, 15_000);

  it('404 — booking does not exist', async () => {
    const res = await request(app)
      .patch(`/tenants/${tenantId}/bookings/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });

    expect(res.status).toBe(404);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// PATCH /tenants/:id/bookings/:id — reschedule
// ---------------------------------------------------------------------------

describe('PATCH /tenants/:id/bookings/:id — reschedule', () => {
  let resourceId: string;
  // blocker: stays at MON2 13:00-14:00 throughout; used to test overlap rejection
  let blockerId: string;
  // mover: starts at MON2 09:00-10:00; rescheduled in the first test
  let moverId: string;

  beforeAll(async () => {
    resourceId = await createResource(tenantId, 'Reschedule Resource');
    await createRule(tenantId, resourceId, 1, '09:00', '17:00');
    blockerId = await createBooking(tenantId, resourceId, `${MON2}T13:00:00Z`, `${MON2}T14:00:00Z`);
    moverId = await createBooking(tenantId, resourceId, `${MON2}T09:00:00Z`, `${MON2}T10:00:00Z`);
  });

  it('200 — reschedules to a free slot', async () => {
    const res = await request(app)
      .patch(`/tenants/${tenantId}/bookings/${moverId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startAt: `${MON2}T10:00:00Z`, endAt: `${MON2}T11:00:00Z` });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(moverId);
    // mover is now at 10:00-11:00
  }, 15_000);

  it('200 — rescheduling to the same slot (self-exclude) is allowed', async () => {
    const res = await request(app)
      .patch(`/tenants/${tenantId}/bookings/${blockerId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startAt: `${MON2}T13:00:00Z`, endAt: `${MON2}T14:00:00Z` });

    expect(res.status).toBe(200);
  }, 15_000);

  it('409 — new slot overlaps an existing booking', async () => {
    // mover is at 10:00-11:00; try to move it into blocker's slot 13:30-14:30
    const res = await request(app)
      .patch(`/tenants/${tenantId}/bookings/${moverId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startAt: `${MON2}T13:30:00Z`, endAt: `${MON2}T14:30:00Z` });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'overlap' });
  }, 15_000);

  it('409 — new slot is outside availability rules', async () => {
    const res = await request(app)
      .patch(`/tenants/${tenantId}/bookings/${moverId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startAt: `${MON2}T18:00:00Z`, endAt: `${MON2}T19:00:00Z` });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'outside_availability' });
  }, 15_000);

  it('422 — startAt >= endAt', async () => {
    const res = await request(app)
      .patch(`/tenants/${tenantId}/bookings/${moverId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startAt: `${MON2}T15:00:00Z`, endAt: `${MON2}T14:00:00Z` });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);

  it('404 — booking does not exist', async () => {
    const res = await request(app)
      .patch(`/tenants/${tenantId}/bookings/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startAt: `${MON2}T15:00:00Z`, endAt: `${MON2}T16:00:00Z` });

    expect(res.status).toBe(404);
  }, 15_000);
});
