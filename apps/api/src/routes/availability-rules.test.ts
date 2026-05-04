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

function base(tid: string, sid: string) {
  return `/tenants/${tid}/services/${sid}/availability-rules`;
}

async function createService(tid: string, name: string): Promise<string> {
  let id!: string;
  await withTenantContext(pool, tid, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO services (tenant_id, name) VALUES ($1, $2) RETURNING id',
      [tid, name],
    );
    id = rows[0].id;
  });
  return id;
}

async function createRule(
  tid: string,
  sid: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): Promise<string> {
  let id!: string;
  await withTenantContext(pool, tid, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO availability_rules (tenant_id, service_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [tid, sid, dayOfWeek, startTime, endTime],
    );
    id = rows[0].id;
  });
  return id;
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'a'.repeat(32);
  pool = createDb();
  await pool.query('TRUNCATE bookings, availability_rules, services, users, tenants CASCADE');

  const res1 = await request(app).post('/auth/signup').send({
    email: 'avail-owner@example.com',
    password: 'password123',
    businessName: 'Avail Biz',
    slug: 'avail-biz',
  });
  token = res1.body.token;
  tenantId = parseJwt(token).tenantId;

  const res2 = await request(app).post('/auth/signup').send({
    email: 'avail-other@example.com',
    password: 'password123',
    businessName: 'Other Avail Biz',
    slug: 'other-avail-biz',
  });
  otherTenantId = parseJwt(res2.body.token).tenantId;
});

afterAll(async () => {
  await pool.query('TRUNCATE bookings, availability_rules, services, users, tenants CASCADE');
  await pool.end();
  delete process.env.JWT_SECRET;
});

// ---------------------------------------------------------------------------
// POST .../availability-rules
// ---------------------------------------------------------------------------

describe('POST .../availability-rules', () => {
  let postServiceId: string;

  beforeAll(async () => {
    postServiceId = await createService(tenantId, 'Post Test Service');
    // Seed rule: Monday 09:00-13:00 — used to test overlap rejection
    await createRule(tenantId, postServiceId, 1, '09:00', '13:00');
  });

  it('201 — creates rule with no conflict', async () => {
    const res = await request(app)
      .post(base(tenantId, postServiceId))
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 1, startTime: '15:00', endTime: '19:00' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      tenantId,
      serviceId: postServiceId,
      dayOfWeek: 1,
      startTime: '15:00',
      endTime: '19:00',
    });
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.createdAt).toBe('string');
  }, 15_000);

  it('201 — adjacent rule (touching boundary) is not an overlap', async () => {
    const res = await request(app)
      .post(base(tenantId, postServiceId))
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 1, startTime: '13:00', endTime: '15:00' });

    expect(res.status).toBe(201);
  }, 15_000);

  it('201 — same times on a different day is not an overlap', async () => {
    const res = await request(app)
      .post(base(tenantId, postServiceId))
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 2, startTime: '09:00', endTime: '13:00' });

    expect(res.status).toBe(201);
  }, 15_000);

  it('409 overlap — overlapping rule on same day', async () => {
    const res = await request(app)
      .post(base(tenantId, postServiceId))
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 1, startTime: '12:00', endTime: '16:00' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'overlap' });
  }, 15_000);

  it('422 — startTime > endTime', async () => {
    const res = await request(app)
      .post(base(tenantId, postServiceId))
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 1, startTime: '17:00', endTime: '09:00' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);

  it('422 — startTime equals endTime', async () => {
    const res = await request(app)
      .post(base(tenantId, postServiceId))
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 1, startTime: '09:00', endTime: '09:00' });

    expect(res.status).toBe(422);
  }, 15_000);

  it('422 — missing required fields', async () => {
    const res = await request(app)
      .post(base(tenantId, postServiceId))
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 1 });

    expect(res.status).toBe(422);
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .post(base(otherTenantId, postServiceId))
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' });

    expect(res.status).toBe(403);
  }, 15_000);

  it('404 — service does not exist', async () => {
    const res = await request(app)
      .post(base(tenantId, '00000000-0000-0000-0000-000000000000'))
      .set('Authorization', `Bearer ${token}`)
      .send({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' });

    expect(res.status).toBe(404);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// GET .../availability-rules (list)
// ---------------------------------------------------------------------------

describe('GET .../availability-rules', () => {
  let listServiceId: string;

  beforeAll(async () => {
    listServiceId = await createService(tenantId, 'List Test Service');
    await createRule(tenantId, listServiceId, 3, '10:00', '18:00');
  });

  it('200 — returns array of rules for the service', async () => {
    const res = await request(app)
      .get(base(tenantId, listServiceId))
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({ tenantId, serviceId: listServiceId });
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .get(base(otherTenantId, listServiceId))
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  }, 15_000);

  it('404 — service does not exist', async () => {
    const res = await request(app)
      .get(base(tenantId, '00000000-0000-0000-0000-000000000000'))
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// GET .../availability-rules/:id
// ---------------------------------------------------------------------------

describe('GET .../availability-rules/:id', () => {
  let getServiceId: string;
  let ruleId: string;

  beforeAll(async () => {
    getServiceId = await createService(tenantId, 'Get Rule Service');
    ruleId = await createRule(tenantId, getServiceId, 4, '08:00', '16:00');
  });

  it('200 — returns the rule', async () => {
    const res = await request(app)
      .get(`${base(tenantId, getServiceId)}/${ruleId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: ruleId,
      tenantId,
      serviceId: getServiceId,
      dayOfWeek: 4,
      startTime: '08:00',
      endTime: '16:00',
    });
  }, 15_000);

  it('404 — rule does not exist', async () => {
    const res = await request(app)
      .get(`${base(tenantId, getServiceId)}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  }, 15_000);
});

// ---------------------------------------------------------------------------
// PATCH .../availability-rules/:id
// ---------------------------------------------------------------------------

describe('PATCH .../availability-rules/:id', () => {
  let patchServiceId: string;
  let rule1Id: string;
  let rule2Id: string;

  beforeAll(async () => {
    patchServiceId = await createService(tenantId, 'Patch Rule Service');
    // rule1: Monday 09:00-13:00
    // rule2: Monday 15:00-19:00
    rule1Id = await createRule(tenantId, patchServiceId, 1, '09:00', '13:00');
    rule2Id = await createRule(tenantId, patchServiceId, 1, '15:00', '19:00');
  });

  it('200 — updates a single field (endTime)', async () => {
    const res = await request(app)
      .patch(`${base(tenantId, patchServiceId)}/${rule2Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ endTime: '20:00' });

    expect(res.status).toBe(200);
    expect(res.body.endTime).toBe('20:00');
    expect(res.body.startTime).toBe('15:00');
  }, 15_000);

  it('200 — updating a rule to its own values does not self-conflict', async () => {
    const res = await request(app)
      .patch(`${base(tenantId, patchServiceId)}/${rule1Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: '09:00', endTime: '13:00' });

    expect(res.status).toBe(200);
  }, 15_000);

  it('409 overlap — updated times overlap another rule', async () => {
    // rule2 is currently 15:00-20:00; moving it to 12:00-16:00 overlaps rule1 09:00-13:00
    const res = await request(app)
      .patch(`${base(tenantId, patchServiceId)}/${rule2Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: '12:00', endTime: '16:00' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'overlap' });
  }, 15_000);

  it('422 — resulting startTime >= endTime', async () => {
    const res = await request(app)
      .patch(`${base(tenantId, patchServiceId)}/${rule1Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: '14:00', endTime: '10:00' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);

  it('422 — empty body', async () => {
    const res = await request(app)
      .patch(`${base(tenantId, patchServiceId)}/${rule1Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  }, 15_000);

  it('404 — rule does not exist', async () => {
    const res = await request(app)
      .patch(`${base(tenantId, patchServiceId)}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: '09:00' });

    expect(res.status).toBe(404);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// DELETE .../availability-rules/:id
// ---------------------------------------------------------------------------

describe('DELETE .../availability-rules/:id', () => {
  let deleteServiceId: string;

  beforeAll(async () => {
    deleteServiceId = await createService(tenantId, 'Delete Rule Service');
  });

  it('204 — deletes rule', async () => {
    const ruleId = await createRule(tenantId, deleteServiceId, 5, '09:00', '17:00');

    const res = await request(app)
      .delete(`${base(tenantId, deleteServiceId)}/${ruleId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  }, 15_000);

  it('404 — rule does not exist', async () => {
    const res = await request(app)
      .delete(`${base(tenantId, deleteServiceId)}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const otherServiceId = await createService(otherTenantId, 'Other Delete Service');
    const otherRuleId = await createRule(otherTenantId, otherServiceId, 1, '09:00', '17:00');

    const res = await request(app)
      .delete(`${base(otherTenantId, otherServiceId)}/${otherRuleId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  }, 15_000);
});
