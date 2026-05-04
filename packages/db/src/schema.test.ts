import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { migrate } from './migrator.js';

neonConfig.webSocketConstructor = ws;

let pool: Pool;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any;

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');

  pool = new Pool({ connectionString: url });
  client = await pool.connect();

  await client.query(
    'DROP TABLE IF EXISTS bookings, availability_rules, services, tenants, schema_migrations CASCADE',
  );

  await migrate(url);
});

afterAll(async () => {
  await client.query(
    'DROP TABLE IF EXISTS bookings, availability_rules, services, tenants, schema_migrations CASCADE',
  );
  client.release();
  await pool.end();
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function insertTenant(slug: string, name = 'Test Business') {
  const result = await client.query(
    'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
    [name, slug],
  );
  return result.rows[0].id as string;
}

async function insertService(tenantId: string, name = 'Test Service') {
  const result = await client.query(
    'INSERT INTO services (tenant_id, name) VALUES ($1, $2) RETURNING id',
    [tenantId, name],
  );
  return result.rows[0].id as string;
}

// ---------------------------------------------------------------------------
// tenants
// ---------------------------------------------------------------------------

describe('tenants', () => {
  afterEach(async () => {
    await client.query("DELETE FROM tenants WHERE slug LIKE 'test-%'");
  });

  it('inserts successfully and returns a uuid', async () => {
    const { rows } = await client.query(
      'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id, created_at',
      ['Test Barber', 'test-barber-ok'],
    );
    expect(rows[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(rows[0].created_at).toBeInstanceOf(Date);
  });

  it('rejects duplicate slug', async () => {
    await client.query('INSERT INTO tenants (name, slug) VALUES ($1, $2)', [
      'T1',
      'test-slug-dup',
    ]);
    await expect(
      client.query('INSERT INTO tenants (name, slug) VALUES ($1, $2)', [
        'T2',
        'test-slug-dup',
      ]),
    ).rejects.toMatchObject({ code: '23505' }); // unique_violation
  });

  it('rejects null name', async () => {
    await expect(
      client.query('INSERT INTO tenants (name, slug) VALUES ($1, $2)', [
        null,
        'test-null-name',
      ]),
    ).rejects.toMatchObject({ code: '23502' }); // not_null_violation
  });
});

// ---------------------------------------------------------------------------
// services
// ---------------------------------------------------------------------------

describe('services', () => {
  let tenantId: string;

  beforeAll(async () => {
    tenantId = await insertTenant('test-services-tenant');
  });

  afterAll(async () => {
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });

  it('inserts successfully', async () => {
    const { rows } = await client.query(
      'INSERT INTO services (tenant_id, name) VALUES ($1, $2) RETURNING id',
      [tenantId, 'Chair 1'],
    );
    expect(rows[0].id).toBeDefined();
  });

  it('rejects unknown tenant_id (FK violation)', async () => {
    await expect(
      client.query(
        'INSERT INTO services (tenant_id, name) VALUES ($1, $2)',
        ['00000000-0000-0000-0000-000000000000', 'Ghost Service'],
      ),
    ).rejects.toMatchObject({ code: '23503' }); // foreign_key_violation
  });

  it('cascades delete to services when tenant is deleted', async () => {
    const tmpTenantId = await insertTenant('test-cascade-tenant');
    const serviceId = await insertService(tmpTenantId);

    await client.query('DELETE FROM tenants WHERE id = $1', [tmpTenantId]);

    const { rows } = await client.query(
      'SELECT id FROM services WHERE id = $1',
      [serviceId],
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// availability_rules
// ---------------------------------------------------------------------------

describe('availability_rules', () => {
  let tenantId: string;
  let serviceId: string;

  beforeAll(async () => {
    tenantId = await insertTenant('test-avail-tenant');
    serviceId = await insertService(tenantId);
  });

  afterAll(async () => {
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });

  it('inserts a valid rule', async () => {
    const { rows } = await client.query(
      `INSERT INTO availability_rules (tenant_id, service_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, serviceId, 1, '09:00', '17:00'],
    );
    expect(rows[0].id).toBeDefined();
  });

  it('rejects start_time >= end_time', async () => {
    await expect(
      client.query(
        `INSERT INTO availability_rules (tenant_id, service_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, serviceId, 1, '17:00', '09:00'],
      ),
    ).rejects.toMatchObject({ code: '23514' }); // check_violation
  });

  it('rejects day_of_week = 7', async () => {
    await expect(
      client.query(
        `INSERT INTO availability_rules (tenant_id, service_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, serviceId, 7, '09:00', '17:00'],
      ),
    ).rejects.toMatchObject({ code: '23514' }); // check_violation
  });

  it('cascades delete when service is deleted', async () => {
    const tmpTenantId = await insertTenant('test-rule-cascade-tenant');
    const tmpServiceId = await insertService(tmpTenantId);
    const { rows } = await client.query(
      `INSERT INTO availability_rules (tenant_id, service_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tmpTenantId, tmpServiceId, 2, '10:00', '18:00'],
    );
    const ruleId = rows[0].id;

    await client.query('DELETE FROM services WHERE id = $1', [tmpServiceId]);

    const check = await client.query(
      'SELECT id FROM availability_rules WHERE id = $1',
      [ruleId],
    );
    expect(check.rows).toHaveLength(0);

    await client.query('DELETE FROM tenants WHERE id = $1', [tmpTenantId]);
  });
});

// ---------------------------------------------------------------------------
// bookings
// ---------------------------------------------------------------------------

describe('bookings', () => {
  let tenantId: string;
  let serviceId: string;

  beforeAll(async () => {
    tenantId = await insertTenant('test-bookings-tenant');
    serviceId = await insertService(tenantId);
  });

  afterAll(async () => {
    // bookings ON DELETE RESTRICT means we must delete bookings before tenant
    await client.query('DELETE FROM bookings WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });

  it('inserts successfully with default status', async () => {
    const { rows } = await client.query(
      `INSERT INTO bookings (tenant_id, service_id, client_name, client_email, start_at, end_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, status`,
      [
        tenantId,
        serviceId,
        'Alice',
        'alice@example.com',
        '2026-05-01 09:00:00+00',
        '2026-05-01 10:00:00+00',
      ],
    );
    expect(rows[0].id).toBeDefined();
    expect(rows[0].status).toBe('pending');
  });

  it('rejects start_at >= end_at', async () => {
    await expect(
      client.query(
        `INSERT INTO bookings (tenant_id, service_id, client_name, client_email, start_at, end_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantId,
          serviceId,
          'Bob',
          'bob@example.com',
          '2026-05-01 10:00:00+00',
          '2026-05-01 09:00:00+00',
        ],
      ),
    ).rejects.toMatchObject({ code: '23514' }); // check_violation
  });

  it('rejects invalid status value', async () => {
    await expect(
      client.query(
        `INSERT INTO bookings (tenant_id, service_id, client_name, client_email, start_at, end_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          serviceId,
          'Carol',
          'carol@example.com',
          '2026-05-01 11:00:00+00',
          '2026-05-01 12:00:00+00',
          'unknown',
        ],
      ),
    ).rejects.toMatchObject({ code: '23514' }); // check_violation
  });

  it('blocks tenant deletion when bookings exist (RESTRICT)', async () => {
    const tmpTenantId = await insertTenant('test-restrict-tenant');
    const tmpServiceId = await insertService(tmpTenantId);
    await client.query(
      `INSERT INTO bookings (tenant_id, service_id, client_name, client_email, start_at, end_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tmpTenantId,
        tmpServiceId,
        'Dave',
        'dave@example.com',
        '2026-05-02 09:00:00+00',
        '2026-05-02 10:00:00+00',
      ],
    );

    await expect(
      client.query('DELETE FROM tenants WHERE id = $1', [tmpTenantId]),
    ).rejects.toMatchObject({ code: '23503' }); // foreign_key_violation

    // cleanup
    await client.query('DELETE FROM bookings WHERE tenant_id = $1', [tmpTenantId]);
    await client.query('DELETE FROM tenants WHERE id = $1', [tmpTenantId]);
  });

  it('blocks service deletion when bookings exist (RESTRICT)', async () => {
    const tmpTenantId = await insertTenant('test-service-restrict-tenant');
    const tmpServiceId = await insertService(tmpTenantId);
    await client.query(
      `INSERT INTO bookings (tenant_id, service_id, client_name, client_email, start_at, end_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tmpTenantId,
        tmpServiceId,
        'Eve',
        'eve@example.com',
        '2026-05-03 09:00:00+00',
        '2026-05-03 10:00:00+00',
      ],
    );

    await expect(
      client.query('DELETE FROM services WHERE id = $1', [tmpServiceId]),
    ).rejects.toMatchObject({ code: '23503' }); // foreign_key_violation

    // cleanup
    await client.query('DELETE FROM bookings WHERE tenant_id = $1', [tmpTenantId]);
    await client.query('DELETE FROM tenants WHERE id = $1', [tmpTenantId]);
  });
});

// ---------------------------------------------------------------------------
// RLS — deferred to M3 (requires non-owner app role)
// ---------------------------------------------------------------------------

describe.skip('RLS (deferred to M3 — requires non-owner app role)', () => {
  /**
   * Postgres RLS is not enforced for the table owner / superuser by default.
   * Full enforcement requires:
   *   1. A dedicated app role with only DML privileges (no table ownership).
   *   2. GRANT SELECT, INSERT, UPDATE, DELETE ON tables TO app_role.
   *   3. FORCE ROW LEVEL SECURITY on each table (optional but recommended for prod).
   *
   * These are introduced in M3 alongside tenant auth and the DB role setup.
   * The tests below define the expected behaviour and will be unskipped in M3.
   */

  it('service is invisible to a different tenant context', async () => {
    // SET LOCAL only works inside a transaction
    const tenantAId = await insertTenant('test-rls-a');
    const tenantBId = await insertTenant('test-rls-b');
    await insertService(tenantAId, 'Service A');

    const result = await client.query(`
      BEGIN;
      SET LOCAL app.current_tenant_id = '${tenantBId}';
      SELECT id FROM services WHERE tenant_id = '${tenantAId}';
      COMMIT;
    `);

    expect(result.rows).toHaveLength(0);

    await client.query('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantAId, tenantBId]);
  });

  it('service is visible when tenant context matches', async () => {
    const tenantId = await insertTenant('test-rls-match');
    await insertService(tenantId, 'Visible Service');

    const result = await client.query(`
      BEGIN;
      SET LOCAL app.current_tenant_id = '${tenantId}';
      SELECT id FROM services WHERE tenant_id = '${tenantId}';
      COMMIT;
    `);

    expect(result.rows.length).toBeGreaterThan(0);

    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });
});
