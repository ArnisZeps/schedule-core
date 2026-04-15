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
    'DROP TABLE IF EXISTS bookings, availability_rules, resources, tenants, schema_migrations CASCADE',
  );

  await migrate(url);
});

afterAll(async () => {
  await client.query(
    'DROP TABLE IF EXISTS bookings, availability_rules, resources, tenants, schema_migrations CASCADE',
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

async function insertResource(tenantId: string, name = 'Test Resource') {
  const result = await client.query(
    'INSERT INTO resources (tenant_id, name) VALUES ($1, $2) RETURNING id',
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
// resources
// ---------------------------------------------------------------------------

describe('resources', () => {
  let tenantId: string;

  beforeAll(async () => {
    tenantId = await insertTenant('test-resources-tenant');
  });

  afterAll(async () => {
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });

  it('inserts successfully', async () => {
    const { rows } = await client.query(
      'INSERT INTO resources (tenant_id, name) VALUES ($1, $2) RETURNING id',
      [tenantId, 'Chair 1'],
    );
    expect(rows[0].id).toBeDefined();
  });

  it('rejects unknown tenant_id (FK violation)', async () => {
    await expect(
      client.query(
        'INSERT INTO resources (tenant_id, name) VALUES ($1, $2)',
        ['00000000-0000-0000-0000-000000000000', 'Ghost Resource'],
      ),
    ).rejects.toMatchObject({ code: '23503' }); // foreign_key_violation
  });

  it('cascades delete to resources when tenant is deleted', async () => {
    const tmpTenantId = await insertTenant('test-cascade-tenant');
    const resourceId = await insertResource(tmpTenantId);

    await client.query('DELETE FROM tenants WHERE id = $1', [tmpTenantId]);

    const { rows } = await client.query(
      'SELECT id FROM resources WHERE id = $1',
      [resourceId],
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// availability_rules
// ---------------------------------------------------------------------------

describe('availability_rules', () => {
  let tenantId: string;
  let resourceId: string;

  beforeAll(async () => {
    tenantId = await insertTenant('test-avail-tenant');
    resourceId = await insertResource(tenantId);
  });

  afterAll(async () => {
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });

  it('inserts a valid rule', async () => {
    const { rows } = await client.query(
      `INSERT INTO availability_rules (tenant_id, resource_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, resourceId, 1, '09:00', '17:00'],
    );
    expect(rows[0].id).toBeDefined();
  });

  it('rejects start_time >= end_time', async () => {
    await expect(
      client.query(
        `INSERT INTO availability_rules (tenant_id, resource_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, resourceId, 1, '17:00', '09:00'],
      ),
    ).rejects.toMatchObject({ code: '23514' }); // check_violation
  });

  it('rejects day_of_week = 7', async () => {
    await expect(
      client.query(
        `INSERT INTO availability_rules (tenant_id, resource_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, resourceId, 7, '09:00', '17:00'],
      ),
    ).rejects.toMatchObject({ code: '23514' }); // check_violation
  });

  it('cascades delete when resource is deleted', async () => {
    const tmpTenantId = await insertTenant('test-rule-cascade-tenant');
    const tmpResourceId = await insertResource(tmpTenantId);
    const { rows } = await client.query(
      `INSERT INTO availability_rules (tenant_id, resource_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tmpTenantId, tmpResourceId, 2, '10:00', '18:00'],
    );
    const ruleId = rows[0].id;

    await client.query('DELETE FROM resources WHERE id = $1', [tmpResourceId]);

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
  let resourceId: string;

  beforeAll(async () => {
    tenantId = await insertTenant('test-bookings-tenant');
    resourceId = await insertResource(tenantId);
  });

  afterAll(async () => {
    // bookings ON DELETE RESTRICT means we must delete bookings before tenant
    await client.query('DELETE FROM bookings WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });

  it('inserts successfully with default status', async () => {
    const { rows } = await client.query(
      `INSERT INTO bookings (tenant_id, resource_id, client_name, client_email, start_at, end_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, status`,
      [
        tenantId,
        resourceId,
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
        `INSERT INTO bookings (tenant_id, resource_id, client_name, client_email, start_at, end_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantId,
          resourceId,
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
        `INSERT INTO bookings (tenant_id, resource_id, client_name, client_email, start_at, end_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          resourceId,
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
    const tmpResourceId = await insertResource(tmpTenantId);
    await client.query(
      `INSERT INTO bookings (tenant_id, resource_id, client_name, client_email, start_at, end_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tmpTenantId,
        tmpResourceId,
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

  it('blocks resource deletion when bookings exist (RESTRICT)', async () => {
    const tmpTenantId = await insertTenant('test-resource-restrict-tenant');
    const tmpResourceId = await insertResource(tmpTenantId);
    await client.query(
      `INSERT INTO bookings (tenant_id, resource_id, client_name, client_email, start_at, end_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tmpTenantId,
        tmpResourceId,
        'Eve',
        'eve@example.com',
        '2026-05-03 09:00:00+00',
        '2026-05-03 10:00:00+00',
      ],
    );

    await expect(
      client.query('DELETE FROM resources WHERE id = $1', [tmpResourceId]),
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

  it('resource is invisible to a different tenant context', async () => {
    // SET LOCAL only works inside a transaction
    const tenantAId = await insertTenant('test-rls-a');
    const tenantBId = await insertTenant('test-rls-b');
    await insertResource(tenantAId, 'Resource A');

    const result = await client.query(`
      BEGIN;
      SET LOCAL app.current_tenant_id = '${tenantBId}';
      SELECT id FROM resources WHERE tenant_id = '${tenantAId}';
      COMMIT;
    `);

    expect(result.rows).toHaveLength(0);

    await client.query('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantAId, tenantBId]);
  });

  it('resource is visible when tenant context matches', async () => {
    const tenantId = await insertTenant('test-rls-match');
    await insertResource(tenantId, 'Visible Resource');

    const result = await client.query(`
      BEGIN;
      SET LOCAL app.current_tenant_id = '${tenantId}';
      SELECT id FROM resources WHERE tenant_id = '${tenantId}';
      COMMIT;
    `);

    expect(result.rows.length).toBeGreaterThan(0);

    await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  });
});
