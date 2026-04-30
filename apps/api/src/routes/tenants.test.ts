import request from 'supertest';
import { createDb, type Db } from '@schedule-core/db';
import { app } from '../app.js';
import { signToken } from '../lib/jwt.js';
import { withTenantContext } from '../middleware/tenant-context.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');

let pool: Db;
let token: string;
let tenantId: string;
let otherTenantId: string;

function parseJwt(t: string): { sub: string; tenantId: string } {
  return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
}

async function makeTenant(name: string, slug: string): Promise<{ tenantId: string; token: string }> {
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
    [name, slug],
  );
  const id = rows[0].id;
  return { tenantId: id, token: signToken({ sub: '00000000-0000-0000-0000-000000000001', tenantId: id }) };
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'a'.repeat(32);
  pool = createDb();
  await pool.query('TRUNCATE bookings, availability_rules, resources, users, tenants CASCADE');

  const res1 = await request(app).post('/auth/signup').send({
    email: 'tenant-owner@example.com',
    password: 'password123',
    businessName: 'Main Biz',
    slug: 'main-biz',
  });
  token = res1.body.token;
  tenantId = parseJwt(token).tenantId;

  const res2 = await request(app).post('/auth/signup').send({
    email: 'tenant-other@example.com',
    password: 'password123',
    businessName: 'Other Biz',
    slug: 'other-biz',
  });
  otherTenantId = parseJwt(res2.body.token).tenantId;
});

afterAll(async () => {
  await pool.query('TRUNCATE bookings, availability_rules, resources, users, tenants CASCADE');
  await pool.end();
  delete process.env.JWT_SECRET;
});

// ---------------------------------------------------------------------------
// GET /tenants/:id
// ---------------------------------------------------------------------------

describe('GET /tenants/:id', () => {
  it('200 — returns own tenant', async () => {
    const res = await request(app)
      .get(`/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: tenantId, name: 'Main Biz', slug: 'main-biz' });
    expect(typeof res.body.createdAt).toBe('string');
  }, 15_000);

  it('401 — missing token', async () => {
    const res = await request(app).get(`/tenants/${tenantId}`);
    expect(res.status).toBe(401);
  }, 15_000);

  it('403 — another tenant\'s id', async () => {
    const res = await request(app)
      .get(`/tenants/${otherTenantId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  }, 15_000);

  it('404 — tenant does not exist', async () => {
    const { tenantId: staleId, token: staleToken } = await makeTenant('Stale GET', 'stale-get');
    await pool.query('DELETE FROM tenants WHERE id = $1', [staleId]);

    const res = await request(app)
      .get(`/tenants/${staleId}`)
      .set('Authorization', `Bearer ${staleToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  }, 15_000);
});

// ---------------------------------------------------------------------------
// PATCH /tenants/:id
// ---------------------------------------------------------------------------

describe('PATCH /tenants/:id', () => {
  it('200 — updates name', async () => {
    const res = await request(app)
      .patch(`/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Main Biz' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Main Biz');
    expect(res.body.id).toBe(tenantId);
  }, 15_000);

  it('200 — updates slug', async () => {
    const res = await request(app)
      .patch(`/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'main-biz-v2' });

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('main-biz-v2');
  }, 15_000);

  it('409 slug_taken — slug belongs to another tenant', async () => {
    const res = await request(app)
      .patch(`/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'other-biz' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'slug_taken' });
  }, 15_000);

  it('422 validation_error — empty body', async () => {
    const res = await request(app)
      .patch(`/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);

  it('403 — another tenant', async () => {
    const res = await request(app)
      .patch(`/tenants/${otherTenantId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  }, 15_000);

  it('404 — tenant does not exist', async () => {
    const { tenantId: staleId, token: staleToken } = await makeTenant('Stale PATCH', 'stale-patch');
    await pool.query('DELETE FROM tenants WHERE id = $1', [staleId]);

    const res = await request(app)
      .patch(`/tenants/${staleId}`)
      .set('Authorization', `Bearer ${staleToken}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// DELETE /tenants/:id
// ---------------------------------------------------------------------------

describe('DELETE /tenants/:id', () => {
  it('403 — another tenant', async () => {
    const res = await request(app)
      .delete(`/tenants/${otherTenantId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  }, 15_000);

  it('404 — tenant does not exist', async () => {
    const { tenantId: staleId, token: staleToken } = await makeTenant('Stale DELETE', 'stale-delete');
    await pool.query('DELETE FROM tenants WHERE id = $1', [staleId]);

    const res = await request(app)
      .delete(`/tenants/${staleId}`)
      .set('Authorization', `Bearer ${staleToken}`);

    expect(res.status).toBe(404);
  }, 15_000);

  it('409 has_bookings — cannot delete tenant with active bookings', async () => {
    const { tenantId: blockedId, token: blockedToken } = await makeTenant('Blocked', 'blocked-biz');

    await withTenantContext(pool, blockedId, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        "INSERT INTO resources (tenant_id, name) VALUES ($1, 'Chair') RETURNING id",
        [blockedId],
      );
      await client.query(
        `INSERT INTO bookings (tenant_id, resource_id, client_name, client_email, start_at, end_at)
         VALUES ($1, $2, 'Client', 'c@c.com', NOW() + INTERVAL '1 hour', NOW() + INTERVAL '2 hours')`,
        [blockedId, rows[0].id],
      );
    });

    const res = await request(app)
      .delete(`/tenants/${blockedId}`)
      .set('Authorization', `Bearer ${blockedToken}`);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'has_bookings' });
  }, 15_000);

  it('204 — deletes tenant successfully', async () => {
    const { tenantId: goneId, token: goneToken } = await makeTenant('Gone', 'gone-biz');

    const res = await request(app)
      .delete(`/tenants/${goneId}`)
      .set('Authorization', `Bearer ${goneToken}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  }, 15_000);
});
