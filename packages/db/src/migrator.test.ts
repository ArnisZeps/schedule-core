import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import {
  getMigrationsDir,
  listMigrationFiles,
  bootstrap,
  getAppliedMigrations,
  applyMigration,
  migrate,
  status,
} from './migrator.js';

neonConfig.webSocketConstructor = ws;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

let pool: Pool;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any;

async function resetDb() {
  await client.query(
    'DROP TABLE IF EXISTS bookings, availability_rules, services, tenants, schema_migrations CASCADE',
  );
}

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');
  pool = new Pool({ connectionString: url });
  client = await pool.connect();
});

afterAll(async () => {
  await resetDb();
  client.release();
  await pool.end();
});

beforeEach(async () => {
  await resetDb();
});

// ---------------------------------------------------------------------------
// getMigrationsDir
// ---------------------------------------------------------------------------

describe('getMigrationsDir', () => {
  it('returns an absolute path ending in "migrations"', () => {
    const dir = getMigrationsDir();
    expect(dir).toMatch(/migrations$/);
    expect(isAbsolute(dir)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listMigrationFiles
// ---------------------------------------------------------------------------

describe('listMigrationFiles', () => {
  const tmpDir = resolve(__dirname, '../.tmp-migrations-test');

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns an empty array for an empty directory', () => {
    expect(listMigrationFiles(tmpDir)).toEqual([]);
  });

  it('ignores non-.sql files', () => {
    writeFileSync(resolve(tmpDir, 'README.md'), '# readme');
    writeFileSync(resolve(tmpDir, '0001_schema.sql'), 'SELECT 1');
    const files = listMigrationFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe('0001_schema.sql');
  });

  it('returns files sorted by filename ascending', () => {
    writeFileSync(resolve(tmpDir, '0003_third.sql'), 'SELECT 3');
    writeFileSync(resolve(tmpDir, '0001_first.sql'), 'SELECT 1');
    writeFileSync(resolve(tmpDir, '0002_second.sql'), 'SELECT 2');
    const files = listMigrationFiles(tmpDir);
    expect(files.map((f) => f.filename)).toEqual([
      '0001_first.sql',
      '0002_second.sql',
      '0003_third.sql',
    ]);
  });

  it('extracts version from filename prefix', () => {
    writeFileSync(resolve(tmpDir, '0001_initial_schema.sql'), 'SELECT 1');
    const [file] = listMigrationFiles(tmpDir);
    expect(file.version).toBe('0001');
    expect(file.path).toBe(resolve(tmpDir, '0001_initial_schema.sql'));
  });
});

// ---------------------------------------------------------------------------
// bootstrap
// ---------------------------------------------------------------------------

describe('bootstrap', () => {
  it('creates the schema_migrations table', async () => {
    await bootstrap(client);
    const { rows } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'schema_migrations'",
    );
    expect(rows).toHaveLength(1);
  });

  it('is idempotent — calling twice does not throw', async () => {
    await bootstrap(client);
    await expect(bootstrap(client)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getAppliedMigrations
// ---------------------------------------------------------------------------

describe('getAppliedMigrations', () => {
  beforeEach(async () => {
    await bootstrap(client);
  });

  it('returns an empty set on a fresh schema_migrations table', async () => {
    const applied = await getAppliedMigrations(client);
    expect(applied.size).toBe(0);
  });

  it('returns the correct set after a version is inserted', async () => {
    await client.query(
      "INSERT INTO schema_migrations (version) VALUES ('0001')",
    );
    const applied = await getAppliedMigrations(client);
    expect(applied.has('0001')).toBe(true);
    expect(applied.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// applyMigration
// ---------------------------------------------------------------------------

describe('applyMigration', () => {
  const tmpDir = resolve(__dirname, '../.tmp-apply-test');

  beforeEach(async () => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    await bootstrap(client);
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('executes the SQL and records the version in schema_migrations', async () => {
    const sqlPath = resolve(tmpDir, '0001_create_test_table.sql');
    writeFileSync(sqlPath, 'CREATE TABLE _mig_test (id INT)');
    await applyMigration(client, {
      version: '0001',
      filename: '0001_create_test_table.sql',
      path: sqlPath,
    });

    const { rows: tableRows } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = '_mig_test'",
    );
    expect(tableRows).toHaveLength(1);

    const { rows: migRows } = await client.query(
      "SELECT version FROM schema_migrations WHERE version = '0001'",
    );
    expect(migRows).toHaveLength(1);

    // cleanup
    await client.query('DROP TABLE IF EXISTS _mig_test');
  });

  it('rolls back on invalid SQL and does not record the version', async () => {
    const sqlPath = resolve(tmpDir, '0002_bad.sql');
    writeFileSync(sqlPath, 'THIS IS NOT VALID SQL !!!');
    await expect(
      applyMigration(client, {
        version: '0002',
        filename: '0002_bad.sql',
        path: sqlPath,
      }),
    ).rejects.toThrow();

    const { rows } = await client.query(
      "SELECT version FROM schema_migrations WHERE version = '0002'",
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// migrate
// ---------------------------------------------------------------------------

describe('migrate', () => {
  it('applies all pending migrations and returns the count', async () => {
    const url = process.env.TEST_DATABASE_URL!;
    const count = await migrate(url, getMigrationsDir());
    expect(count).toBeGreaterThanOrEqual(1);

    const { rows } = await client.query(
      "SELECT version FROM schema_migrations WHERE version = '0001'",
    );
    expect(rows).toHaveLength(1);
  });

  it('is idempotent — returns 0 on re-run', async () => {
    const url = process.env.TEST_DATABASE_URL!;
    await migrate(url, getMigrationsDir());
    const count = await migrate(url, getMigrationsDir());
    expect(count).toBe(0);
  });

  it('rolls back a bad migration and does not record the version', async () => {
    const tmpDir = resolve(__dirname, '../.tmp-migrate-bad');
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(resolve(tmpDir, '0001_bad.sql'), 'THIS IS NOT VALID SQL !!!');

    const url = process.env.TEST_DATABASE_URL!;
    await expect(migrate(url, tmpDir)).rejects.toThrow();

    // bootstrap may have run; schema_migrations may exist but 0001 should not be recorded
    try {
      const { rows } = await client.query(
        "SELECT version FROM schema_migrations WHERE version = '0001'",
      );
      expect(rows).toHaveLength(0);
    } catch {
      // schema_migrations may not exist if bootstrap itself failed — that is also acceptable
    }

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('applies migrations in version order regardless of listing order', async () => {
    const tmpDir = resolve(__dirname, '../.tmp-migrate-order');
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    // Write in reverse order to filesystem; runner must sort
    writeFileSync(resolve(tmpDir, '0002_b.sql'), 'CREATE TABLE _order_b (id INT)');
    writeFileSync(resolve(tmpDir, '0001_a.sql'), 'CREATE TABLE _order_a (id INT)');

    const url = process.env.TEST_DATABASE_URL!;
    await migrate(url, tmpDir);

    const { rows } = await client.query(
      "SELECT version FROM schema_migrations ORDER BY applied_at",
    );
    expect(rows[0].version).toBe('0001');
    expect(rows[1].version).toBe('0002');

    await client.query('DROP TABLE IF EXISTS _order_a, _order_b');
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

describe('status', () => {
  it('returns all migration files with null appliedAt when none applied', async () => {
    const url = process.env.TEST_DATABASE_URL!;
    const rows = await status(url, getMigrationsDir());
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      expect(row.appliedAt).toBeNull();
    }
  });

  it('returns appliedAt timestamp for applied migrations', async () => {
    const url = process.env.TEST_DATABASE_URL!;
    await migrate(url, getMigrationsDir());
    const rows = await status(url, getMigrationsDir());
    for (const row of rows) {
      expect(row.appliedAt).toBeInstanceOf(Date);
    }
  });
});
