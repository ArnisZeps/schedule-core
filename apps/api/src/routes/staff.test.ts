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

async function createStaff(
  tid: string,
  name: string,
  extra: { email?: string; phone?: string; isActive?: boolean } = {},
): Promise<string> {
  let id!: string;
  await withTenantContext(pool, tid, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO staff (tenant_id, name, email, phone, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [tid, name, extra.email ?? null, extra.phone ?? null, extra.isActive ?? true],
    );
    id = rows[0].id;
  });
  return id;
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

async function assignService(tid: string, staffId: string, serviceId: string): Promise<void> {
  await withTenantContext(pool, tid, async (client) => {
    await client.query(
      'INSERT INTO staff_services (tenant_id, staff_id, service_id) VALUES ($1, $2, $3)',
      [tid, staffId, serviceId],
    );
  });
}

async function createScheduleWindow(
  tid: string,
  staffId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): Promise<string> {
  let id!: string;
  await withTenantContext(pool, tid, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO staff_schedules (tenant_id, staff_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [tid, staffId, dayOfWeek, startTime, endTime],
    );
    id = rows[0].id;
  });
  return id;
}

async function createOverride(
  tid: string,
  staffId: string,
  fields: {
    startDate: string;
    endDate: string;
    type: 'available' | 'not_available';
    startTime: string;
    endTime: string;
  },
): Promise<string> {
  let id!: string;
  await withTenantContext(pool, tid, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO staff_schedule_overrides (tenant_id, staff_id, start_date, end_date, type, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [tid, staffId, fields.startDate, fields.endDate, fields.type, fields.startTime, fields.endTime],
    );
    id = rows[0].id;
  });
  return id;
}

function base(tid: string) {
  return `/tenants/${tid}/staff`;
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'a'.repeat(32);
  pool = createDb();
  await pool.query('TRUNCATE bookings, availability_rules, services, users, tenants CASCADE');

  const res1 = await request(app).post('/auth/signup').send({
    email: 'staff-owner@example.com',
    password: 'password123',
    businessName: 'Staff Biz',
    slug: 'staff-biz',
  });
  token = res1.body.token;
  tenantId = parseJwt(token).tenantId;

  const res2 = await request(app).post('/auth/signup').send({
    email: 'staff-other@example.com',
    password: 'password123',
    businessName: 'Other Staff Biz',
    slug: 'other-staff-biz',
  });
  otherTenantId = parseJwt(res2.body.token).tenantId;
});

afterAll(async () => {
  await pool.query('TRUNCATE bookings, availability_rules, services, users, tenants CASCADE');
  await pool.end();
  delete process.env.JWT_SECRET;
});

// ---------------------------------------------------------------------------
// POST /tenants/:tenantId/staff
// ---------------------------------------------------------------------------

describe('POST /tenants/:tenantId/staff', () => {
  it('201 — creates staff with name only', async () => {
    const res = await request(app)
      .post(base(tenantId))
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ tenantId, name: 'Alice', email: null, phone: null, isActive: true });
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.createdAt).toBe('string');
  }, 15_000);

  it('201 — creates staff with email and phone', async () => {
    const res = await request(app)
      .post(base(tenantId))
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bob', email: 'bob@example.com', phone: '+1 555 000 0001' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Bob', email: 'bob@example.com', phone: '+1 555 000 0001' });
  }, 15_000);

  it('422 — missing name', async () => {
    const res = await request(app)
      .post(base(tenantId))
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'noname@example.com' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);

  it('422 — invalid email format', async () => {
    const res = await request(app)
      .post(base(tenantId))
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad Email', email: 'not-an-email' });

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
// GET /tenants/:tenantId/staff
// ---------------------------------------------------------------------------

describe('GET /tenants/:tenantId/staff', () => {
  let activeId: string;
  let inactiveId: string;

  beforeAll(async () => {
    activeId = await createStaff(tenantId, 'List Active');
    inactiveId = await createStaff(tenantId, 'List Inactive', { isActive: false });
  });

  it('200 — returns active staff only by default', async () => {
    const res = await request(app)
      .get(base(tenantId))
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(activeId);
    expect(ids).not.toContain(inactiveId);
    res.body.forEach((s: { isActive: boolean }) => expect(s.isActive).toBe(true));
  }, 15_000);

  it('200 — includeInactive=true returns all staff', async () => {
    const res = await request(app)
      .get(`${base(tenantId)}?includeInactive=true`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(activeId);
    expect(ids).toContain(inactiveId);
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .get(base(otherTenantId))
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// GET /tenants/:tenantId/staff/:staffId
// ---------------------------------------------------------------------------

describe('GET /tenants/:tenantId/staff/:staffId', () => {
  let staffId: string;

  beforeAll(async () => {
    staffId = await createStaff(tenantId, 'Get Me', { email: 'getme@example.com' });
  });

  it('200 — returns staff by id', async () => {
    const res = await request(app)
      .get(`${base(tenantId)}/${staffId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: staffId, tenantId, name: 'Get Me', email: 'getme@example.com' });
  }, 15_000);

  it('404 — staff does not exist', async () => {
    const res = await request(app)
      .get(`${base(tenantId)}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  }, 15_000);

  it('404 — staff belongs to another tenant (RLS)', async () => {
    const otherId = await createStaff(otherTenantId, 'Other Staff');

    const res = await request(app)
      .get(`${base(tenantId)}/${otherId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .get(`${base(otherTenantId)}/${staffId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// PATCH /tenants/:tenantId/staff/:staffId
// ---------------------------------------------------------------------------

describe('PATCH /tenants/:tenantId/staff/:staffId', () => {
  let staffId: string;

  beforeAll(async () => {
    staffId = await createStaff(tenantId, 'Patch Me');
  });

  it('200 — updates profile fields', async () => {
    const res = await request(app)
      .patch(`${base(tenantId)}/${staffId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Patched Name', email: 'patched@example.com', phone: '+1 555 999 0000' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Patched Name', email: 'patched@example.com', phone: '+1 555 999 0000' });
  }, 15_000);

  it('200 — deactivates staff (isActive: false)', async () => {
    const res = await request(app)
      .patch(`${base(tenantId)}/${staffId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  }, 15_000);

  it('200 — reactivates staff (isActive: true)', async () => {
    const res = await request(app)
      .patch(`${base(tenantId)}/${staffId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
  }, 15_000);

  it('200 — clears email with null', async () => {
    const res = await request(app)
      .patch(`${base(tenantId)}/${staffId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: null });

    expect(res.status).toBe(200);
    expect(res.body.email).toBeNull();
  }, 15_000);

  it('404 — staff does not exist', async () => {
    const res = await request(app)
      .patch(`${base(tenantId)}/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .patch(`${base(otherTenantId)}/${staffId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// GET/PUT /tenants/:tenantId/staff/:staffId/services
// ---------------------------------------------------------------------------

describe('Staff service assignment', () => {
  let staffId: string;
  let serviceId1: string;
  let serviceId2: string;

  beforeAll(async () => {
    staffId = await createStaff(tenantId, 'Service Assignment Staff');
    serviceId1 = await createService(tenantId, 'Service Assign Haircut');
    serviceId2 = await createService(tenantId, 'Service Assign Massage');
  });

  it('GET 200 — returns empty array when no assignments', async () => {
    const res = await request(app)
      .get(`${base(tenantId)}/${staffId}/services`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  }, 15_000);

  it('PUT 200 — assigns services (full set)', async () => {
    const res = await request(app)
      .put(`${base(tenantId)}/${staffId}/services`)
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceIds: [serviceId1, serviceId2] });

    expect(res.status).toBe(200);
    const returnedIds = res.body.map((s: { id: string }) => s.id).sort();
    expect(returnedIds).toEqual([serviceId1, serviceId2].sort());
    expect(res.body[0]).toMatchObject({ tenantId });
  }, 15_000);

  it('GET 200 — returns assigned services', async () => {
    const res = await request(app)
      .get(`${base(tenantId)}/${staffId}/services`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.map((s: { id: string }) => s.id).sort();
    expect(ids).toEqual([serviceId1, serviceId2].sort());
  }, 15_000);

  it('PUT 200 — replaces with subset', async () => {
    const res = await request(app)
      .put(`${base(tenantId)}/${staffId}/services`)
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceIds: [serviceId1] });

    expect(res.status).toBe(200);
    expect(res.body.map((s: { id: string }) => s.id)).toEqual([serviceId1]);
  }, 15_000);

  it('PUT 200 — empty array removes all assignments', async () => {
    const res = await request(app)
      .put(`${base(tenantId)}/${staffId}/services`)
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceIds: [] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// GET/PUT /tenants/:tenantId/staff/:staffId/schedules
// ---------------------------------------------------------------------------

describe('Staff schedules', () => {
  let staffId: string;

  beforeAll(async () => {
    staffId = await createStaff(tenantId, 'Schedule Staff');
  });

  it('GET 200 — returns empty array initially', async () => {
    const res = await request(app)
      .get(`${base(tenantId)}/${staffId}/schedules`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  }, 15_000);

  it('PUT 200 — replaces full set (multiple windows including split shift)', async () => {
    const res = await request(app)
      .put(`${base(tenantId)}/${staffId}/schedules`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        windows: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
          { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
          { dayOfWeek: 3, startTime: '10:00', endTime: '16:00' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    expect(res.body[0]).toMatchObject({ dayOfWeek: 1, startTime: '09:00', endTime: '13:00' });
    expect(typeof res.body[0].id).toBe('string');
  }, 15_000);

  it('GET 200 — returns all windows', async () => {
    const res = await request(app)
      .get(`${base(tenantId)}/${staffId}/schedules`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
  }, 15_000);

  it('PUT 200 — empty array removes all windows', async () => {
    const res = await request(app)
      .put(`${base(tenantId)}/${staffId}/schedules`)
      .set('Authorization', `Bearer ${token}`)
      .send({ windows: [] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  }, 15_000);

  it('GET 200 — returns empty array after clearing', async () => {
    const res = await request(app)
      .get(`${base(tenantId)}/${staffId}/schedules`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// POST /tenants/:tenantId/staff/:staffId/overrides
// ---------------------------------------------------------------------------

describe('POST /tenants/:tenantId/staff/:staffId/overrides', () => {
  let staffId: string;

  beforeAll(async () => {
    staffId = await createStaff(tenantId, 'Override Create Staff');
  });

  it('201 — creates available override', async () => {
    const res = await request(app)
      .post(`${base(tenantId)}/${staffId}/overrides`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        startDate: '2026-07-01',
        endDate: '2026-07-01',
        type: 'available',
        startTime: '09:00',
        endTime: '17:00',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      staffId,
      startDate: '2026-07-01',
      endDate: '2026-07-01',
      type: 'available',
      startTime: '09:00',
      endTime: '17:00',
    });
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.createdAt).toBe('string');
  }, 15_000);

  it('201 — creates not_available override spanning multiple days', async () => {
    const res = await request(app)
      .post(`${base(tenantId)}/${staffId}/overrides`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        startDate: '2026-07-04',
        endDate: '2026-07-06',
        type: 'not_available',
        startTime: '00:00',
        endTime: '23:59',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      type: 'not_available',
      startDate: '2026-07-04',
      endDate: '2026-07-06',
    });
  }, 15_000);

  it('422 — startTime >= endTime', async () => {
    const res = await request(app)
      .post(`${base(tenantId)}/${staffId}/overrides`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        startDate: '2026-07-20',
        endDate: '2026-07-20',
        type: 'available',
        startTime: '17:00',
        endTime: '09:00',
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);

  it('422 — startDate > endDate', async () => {
    const res = await request(app)
      .post(`${base(tenantId)}/${staffId}/overrides`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        startDate: '2026-07-25',
        endDate: '2026-07-20',
        type: 'available',
        startTime: '09:00',
        endTime: '17:00',
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .post(`${base(otherTenantId)}/${staffId}/overrides`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        startDate: '2026-07-01',
        endDate: '2026-07-01',
        type: 'available',
        startTime: '09:00',
        endTime: '17:00',
      });

    expect(res.status).toBe(403);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// GET /tenants/:tenantId/staff/:staffId/overrides
// ---------------------------------------------------------------------------

describe('GET /tenants/:tenantId/staff/:staffId/overrides', () => {
  let staffId: string;

  beforeAll(async () => {
    staffId = await createStaff(tenantId, 'Override List Staff');
    await createOverride(tenantId, staffId, {
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      type: 'available',
      startTime: '09:00',
      endTime: '17:00',
    });
    await createOverride(tenantId, staffId, {
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      type: 'not_available',
      startTime: '00:00',
      endTime: '23:59',
    });
  });

  it('200 — returns all overrides without filters', async () => {
    const res = await request(app)
      .get(`${base(tenantId)}/${staffId}/overrides`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toMatchObject({ staffId });
  }, 15_000);

  it('200 — from/to filter returns only overlapping overrides', async () => {
    const res = await request(app)
      .get(`${base(tenantId)}/${staffId}/overrides?from=2026-08-01&to=2026-08-05`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toMatchObject({ type: 'available', startDate: '2026-08-01' });
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const res = await request(app)
      .get(`${base(otherTenantId)}/${staffId}/overrides`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// PATCH /tenants/:tenantId/staff/:staffId/overrides/:overrideId
// ---------------------------------------------------------------------------

describe('PATCH /tenants/:tenantId/staff/:staffId/overrides/:overrideId', () => {
  let staffId: string;
  let overrideId: string;

  beforeAll(async () => {
    staffId = await createStaff(tenantId, 'Override Patch Staff');
    overrideId = await createOverride(tenantId, staffId, {
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      type: 'available',
      startTime: '09:00',
      endTime: '17:00',
    });
  });

  it('200 — updates type and dates', async () => {
    const res = await request(app)
      .patch(`${base(tenantId)}/${staffId}/overrides/${overrideId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        startDate: '2026-09-10',
        endDate: '2026-09-12',
        type: 'not_available',
        startTime: '08:00',
        endTime: '18:00',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: overrideId,
      startDate: '2026-09-10',
      endDate: '2026-09-12',
      type: 'not_available',
      startTime: '08:00',
      endTime: '18:00',
    });
  }, 15_000);

  it('422 — startTime >= endTime on update', async () => {
    const res = await request(app)
      .patch(`${base(tenantId)}/${staffId}/overrides/${overrideId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        startDate: '2026-09-15',
        endDate: '2026-09-15',
        type: 'available',
        startTime: '17:00',
        endTime: '09:00',
      });

    expect(res.status).toBe(422);
  }, 15_000);

  it('404 — override does not exist', async () => {
    const res = await request(app)
      .patch(`${base(tenantId)}/${staffId}/overrides/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        startDate: '2026-09-01',
        endDate: '2026-09-01',
        type: 'available',
        startTime: '09:00',
        endTime: '17:00',
      });

    expect(res.status).toBe(404);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// DELETE /tenants/:tenantId/staff/:staffId/overrides/:overrideId
// ---------------------------------------------------------------------------

describe('DELETE /tenants/:tenantId/staff/:staffId/overrides/:overrideId', () => {
  let staffId: string;

  beforeAll(async () => {
    staffId = await createStaff(tenantId, 'Override Delete Staff');
  });

  it('204 — deletes override', async () => {
    const overrideId = await createOverride(tenantId, staffId, {
      startDate: '2026-10-01',
      endDate: '2026-10-01',
      type: 'available',
      startTime: '09:00',
      endTime: '17:00',
    });

    const res = await request(app)
      .delete(`${base(tenantId)}/${staffId}/overrides/${overrideId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  }, 15_000);

  it('404 — override does not exist', async () => {
    const res = await request(app)
      .delete(`${base(tenantId)}/${staffId}/overrides/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  }, 15_000);

  it('403 — tenantId in URL does not match caller', async () => {
    const overrideId = await createOverride(tenantId, staffId, {
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      type: 'not_available',
      startTime: '09:00',
      endTime: '17:00',
    });

    const res = await request(app)
      .delete(`${base(otherTenantId)}/${staffId}/overrides/${overrideId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  }, 15_000);
});
