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

async function createService(tid: string, name: string, description?: string): Promise<string> {
  let id!: string;
  await withTenantContext(pool, tid, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO services (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING id',
      [tid, name, description ?? null],
    );
    id = rows[0].id;
  });
  return id;
}

function base(tid: string) {
  return `/tenants/${tid}/services`;
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'a'.repeat(32);
  pool = createDb();
  await pool.query('TRUNCATE bookings, availability_rules, services, users, tenants CASCADE');

  const res1 = await request(app).post('/auth/signup').send({
    email: 'service-owner@example.com',
    password: 'password123',
    businessName: 'Service Biz',
    slug: 'service-biz',
  });
  token = res1.body.token;
  tenantId = parseJwt(token).tenantId;

  const res2 = await request(app).post('/auth/signup').send({
    email: 'service-other@example.com',
    password: 'password123',
    businessName: 'Other Service Biz',
    slug: 'other-service-biz',
  });
  otherTenantId = parseJwt(res2.body.token).tenantId;
});

afterAll(async () => {
  await pool.query('TRUNCATE bookings, availability_rules, services, users, tenants CASCADE');
  await pool.end();
  delete process.env.JWT_SECRET;
});

// ---------------------------------------------------------------------------
// POST /tenants/:tenantId/services
// ---------------------------------------------------------------------------

describe('POST /tenants/:tenantId/services', () => {
  it('201 — creates service with description', async () => {
    const res = await request(app)
      .post(base(tenantId))
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Haircut', description: 'Classic haircut' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ tenantId, name: 'Haircut', description: 'Classic haircut' });
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.createdAt).toBe('string');
  }, 15_000);

  it('201 — creates service without description (null)', async () => {
    const res = await request(app)
      .post(base(tenantId))
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Massage' });

    expect(res.status).toBe(201);
    expect(res.body.description).toBeNull();
  }, 15_000);

  it('422 — missing name', async () => {
    const res = await request(app)
      .post(base(tenantId))
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .post(base(otherTenantId))
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Intruder' });

    expect(res.status).toBe(403);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// GET /tenants/:tenantId/services
// ---------------------------------------------------------------------------

describe('GET /tenants/:tenantId/services', () => {
  it('200 — returns array of services', async () => {
    const res = await request(app)
      .get(base(tenantId))
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({ tenantId });
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .get(base(otherTenantId))
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// GET /tenants/:tenantId/services/:id
// ---------------------------------------------------------------------------

describe('GET /tenants/:tenantId/services/:id', () => {
  let serviceId: string;

  beforeAll(async () => {
    serviceId = await createService(tenantId, 'Get Me');
  });

  it('200 — returns service', async () => {
    const res = await request(app)
      .get(`${base(tenantId)}/${serviceId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: serviceId, tenantId, name: 'Get Me' });
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .get(`${base(otherTenantId)}/${serviceId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  }, 15_000);

  it('404 — service does not exist', async () => {
    const res = await request(app)
      .get(`${base(tenantId)}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  }, 15_000);

  it('404 — service belongs to another tenant', async () => {
    const otherServiceId = await createService(otherTenantId, 'Other Haircut');

    const res = await request(app)
      .get(`${base(tenantId)}/${otherServiceId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// PATCH /tenants/:tenantId/services/:id
// ---------------------------------------------------------------------------

describe('PATCH /tenants/:tenantId/services/:id', () => {
  let serviceId: string;

  beforeAll(async () => {
    serviceId = await createService(tenantId, 'Patch Me', 'Original');
  });

  it('200 — updates name', async () => {
    const res = await request(app)
      .patch(`${base(tenantId)}/${serviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Patched Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Patched Name');
  }, 15_000);

  it('200 — clears description with null', async () => {
    const res = await request(app)
      .patch(`${base(tenantId)}/${serviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: null });

    expect(res.status).toBe(200);
    expect(res.body.description).toBeNull();
  }, 15_000);

  it('422 — empty body', async () => {
    const res = await request(app)
      .patch(`${base(tenantId)}/${serviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .patch(`${base(otherTenantId)}/${serviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  }, 15_000);

  it('404 — service does not exist', async () => {
    const res = await request(app)
      .patch(`${base(tenantId)}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// DELETE /tenants/:tenantId/services/:id
// ---------------------------------------------------------------------------

describe('DELETE /tenants/:tenantId/services/:id', () => {
  it('204 — deletes service and cascades availability_rules', async () => {
    const serviceId = await createService(tenantId, 'Delete Me');

    await withTenantContext(pool, tenantId, async (client) => {
      await client.query(
        "INSERT INTO availability_rules (tenant_id, service_id, day_of_week, start_time, end_time) VALUES ($1, $2, 1, '09:00', '17:00')",
        [tenantId, serviceId],
      );
    });

    const res = await request(app)
      .delete(`${base(tenantId)}/${serviceId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  }, 15_000);

  it('409 has_bookings — cannot delete service referenced by bookings', async () => {
    let blockedServiceId!: string;
    await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        "INSERT INTO services (tenant_id, name) VALUES ($1, 'Blocked Haircut') RETURNING id",
        [tenantId],
      );
      blockedServiceId = rows[0].id;
      await client.query(
        `INSERT INTO bookings (tenant_id, service_id, client_name, client_email, start_at, end_at)
         VALUES ($1, $2, 'Client', 'c@c.com', NOW() + INTERVAL '1 hour', NOW() + INTERVAL '2 hours')`,
        [tenantId, blockedServiceId],
      );
    });

    const res = await request(app)
      .delete(`${base(tenantId)}/${blockedServiceId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'has_bookings' });
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const otherServiceId = await createService(otherTenantId, 'Other To Delete');

    const res = await request(app)
      .delete(`${base(otherTenantId)}/${otherServiceId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  }, 15_000);

  it('404 — service does not exist', async () => {
    const res = await request(app)
      .delete(`${base(tenantId)}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  }, 15_000);
});
