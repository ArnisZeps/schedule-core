import request from 'supertest';
import { createDb, type Db } from '@schedule-core/db';
import { app } from '../app.js';
import { withTenantContext } from '../middleware/tenant-context.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');

let pool: Db;
let tenantId: string;
let rateLimitTenantId: string;

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
): Promise<string> {
  let id!: string;
  await withTenantContext(pool, tid, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO bookings (tenant_id, resource_id, client_name, client_email, start_at, end_at, status)
       VALUES ($1, $2, 'Seed Client', 'seed@example.com', $3, $4, 'pending') RETURNING id`,
      [tid, rid, startAt, endAt],
    );
    id = rows[0].id;
  });
  return id;
}

// 2026-05-04 is a Monday (day_of_week = 1)
const MON = '2026-05-04';

beforeAll(async () => {
  process.env.JWT_SECRET = 'a'.repeat(32);
  pool = createDb();
  await pool.query('TRUNCATE bookings, availability_rules, resources, users, tenants CASCADE');

  const res1 = await request(app).post('/auth/signup').send({
    email: 'public-owner@example.com',
    password: 'password123',
    businessName: 'Public Biz',
    slug: 'public-biz',
  });
  tenantId = parseJwt(res1.body.token).tenantId;

  const res2 = await request(app).post('/auth/signup').send({
    email: 'ratelimit-owner@example.com',
    password: 'password123',
    businessName: 'Rate Limit Biz',
    slug: 'rate-limit-biz',
  });
  rateLimitTenantId = parseJwt(res2.body.token).tenantId;
});

afterAll(async () => {
  await pool.query('TRUNCATE bookings, availability_rules, resources, users, tenants CASCADE');
  await pool.end();
  delete process.env.JWT_SECRET;
});

// ---------------------------------------------------------------------------
// GET /public/:slug/resources/:id/slots
// ---------------------------------------------------------------------------

describe('GET /public/:slug/resources/:id/slots', () => {
  let resourceId: string;

  beforeAll(async () => {
    resourceId = await createResource(tenantId, 'Slots Resource');
    // Monday 09:00-17:00: 16 × 30-min slots
    await createRule(tenantId, resourceId, 1, '09:00', '17:00');
  });

  it('200 — returns all available 30-min slots for the day', async () => {
    const res = await request(app)
      .get(`/public/public-biz/resources/${resourceId}/slots?date=${MON}&duration=30`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // 09:00-17:00 = 480 min / 30 = 16 slots
    expect(res.body).toHaveLength(16);
    expect(res.body[0]).toMatchObject({ startAt: expect.any(String), endAt: expect.any(String) });
    // first slot at 09:00
    expect(new Date(res.body[0].startAt).getUTCHours()).toBe(9);
    expect(new Date(res.body[0].endAt).getUTCHours()).toBe(9);
    expect(new Date(res.body[0].endAt).getUTCMinutes()).toBe(30);
  }, 15_000);

  it('200 — booked slots are excluded from results', async () => {
    // Book 10:00-10:30 directly in DB
    await createBooking(tenantId, resourceId, `${MON}T10:00:00Z`, `${MON}T10:30:00Z`);

    const res = await request(app)
      .get(`/public/public-biz/resources/${resourceId}/slots?date=${MON}&duration=30`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(15);
    const bookedSlot = res.body.find(
      (s: { startAt: string }) => new Date(s.startAt).getUTCHours() === 10 && new Date(s.startAt).getUTCMinutes() === 0,
    );
    expect(bookedSlot).toBeUndefined();
  }, 15_000);

  it('400 — missing date param', async () => {
    const res = await request(app)
      .get(`/public/public-biz/resources/${resourceId}/slots?duration=30`);

    expect(res.status).toBe(400);
  }, 15_000);

  it('400 — missing duration param', async () => {
    const res = await request(app)
      .get(`/public/public-biz/resources/${resourceId}/slots?date=${MON}`);

    expect(res.status).toBe(400);
  }, 15_000);

  it('400 — invalid date format', async () => {
    const res = await request(app)
      .get(`/public/public-biz/resources/${resourceId}/slots?date=not-a-date&duration=30`);

    expect(res.status).toBe(400);
  }, 15_000);

  it('404 — tenant slug does not exist', async () => {
    const res = await request(app)
      .get(`/public/nonexistent-slug/resources/${resourceId}/slots?date=${MON}&duration=30`);

    expect(res.status).toBe(404);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// POST /public/:slug/bookings
// ---------------------------------------------------------------------------

describe('POST /public/:slug/bookings', () => {
  let resourceId: string;

  beforeAll(async () => {
    resourceId = await createResource(tenantId, 'Public Create Resource');
    await createRule(tenantId, resourceId, 1, '09:00', '17:00');
    // seed a booking at 09:00-10:00 to enable overlap tests
    await createBooking(tenantId, resourceId, '2026-05-11T09:00:00Z', '2026-05-11T10:00:00Z');
  });

  it('201 — creates booking without auth, no tenantId in response', async () => {
    const res = await request(app)
      .post('/public/public-biz/bookings')
      .send({
        resourceId,
        clientName: 'Public Alice',
        clientEmail: 'public-alice@example.com',
        startAt: `${MON}T13:00:00Z`,
        endAt: `${MON}T14:00:00Z`,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      resourceId,
      clientName: 'Public Alice',
      status: 'pending',
    });
    expect(res.body.tenantId).toBeUndefined();
  }, 15_000);

  it('409 — overlap with existing booking', async () => {
    const res = await request(app)
      .post('/public/public-biz/bookings')
      .send({
        resourceId,
        clientName: 'Public Bob',
        clientEmail: 'public-bob@example.com',
        startAt: '2026-05-11T09:30:00Z',
        endAt: '2026-05-11T10:30:00Z',
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'overlap' });
  }, 15_000);

  it('409 — slot outside availability rules', async () => {
    const res = await request(app)
      .post('/public/public-biz/bookings')
      .send({
        resourceId,
        clientName: 'Public Charlie',
        clientEmail: 'public-charlie@example.com',
        startAt: `${MON}T18:00:00Z`,
        endAt: `${MON}T19:00:00Z`,
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'outside_availability' });
  }, 15_000);

  it('422 — missing required field', async () => {
    const res = await request(app)
      .post('/public/public-biz/bookings')
      .send({
        resourceId,
        clientName: 'Dave',
        startAt: `${MON}T15:00:00Z`,
        endAt: `${MON}T16:00:00Z`,
        // clientEmail missing
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);

  it('404 — tenant slug does not exist', async () => {
    const res = await request(app)
      .post('/public/nonexistent-slug/bookings')
      .send({
        resourceId,
        clientName: 'Eve',
        clientEmail: 'eve@example.com',
        startAt: `${MON}T15:00:00Z`,
        endAt: `${MON}T16:00:00Z`,
      });

    expect(res.status).toBe(404);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// POST /public/:slug/bookings — rate limiting
// ---------------------------------------------------------------------------

describe('POST /public/:slug/bookings — rate limit', () => {
  let resourceId: string;

  beforeAll(async () => {
    // Set a low rate limit so the test can trigger it quickly
    process.env.RATE_LIMIT_MAX = '3';
    resourceId = await createResource(rateLimitTenantId, 'Rate Limit Resource');
    await createRule(rateLimitTenantId, resourceId, 1, '09:00', '17:00');
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_MAX;
  });

  it('429 — returns 429 after rate limit is exceeded', async () => {
    const slots = [
      { startAt: `${MON}T09:00:00Z`, endAt: `${MON}T10:00:00Z` },
      { startAt: `${MON}T10:00:00Z`, endAt: `${MON}T11:00:00Z` },
      { startAt: `${MON}T11:00:00Z`, endAt: `${MON}T12:00:00Z` },
    ];

    for (const slot of slots) {
      await request(app)
        .post('/public/rate-limit-biz/bookings')
        .send({ resourceId, clientName: 'Test', clientEmail: 'test@example.com', ...slot });
    }

    const res = await request(app)
      .post('/public/rate-limit-biz/bookings')
      .send({
        resourceId,
        clientName: 'Test',
        clientEmail: 'test@example.com',
        startAt: `${MON}T12:00:00Z`,
        endAt: `${MON}T13:00:00Z`,
      });

    expect(res.status).toBe(429);
  }, 15_000);
});
