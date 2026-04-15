import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

neonConfig.webSocketConstructor = ws;

export interface MigrationFile {
  version: string;
  filename: string;
  path: string;
}

export interface MigrationRecord {
  version: string;
  applied_at: Date;
}

export function getMigrationsDir(): string {
  return resolve(__dirname, '../migrations');
}

export function listMigrationFiles(migrationsDir: string): MigrationFile[] {
  const entries = readdirSync(migrationsDir);
  return entries
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((filename) => ({
      version: filename.split('_')[0],
      filename,
      path: resolve(migrationsDir, filename),
    }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function bootstrap(client: any): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     TEXT        PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAppliedMigrations(client: any): Promise<Set<string>> {
  const { rows } = await client.query(
    'SELECT version FROM schema_migrations',
  );
  return new Set(rows.map((r: MigrationRecord) => r.version));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyMigration(client: any, migration: MigrationFile): Promise<void> {
  const sql = readFileSync(migration.path, 'utf-8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [migration.version],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

export async function migrate(
  databaseUrl: string,
  migrationsDir = getMigrationsDir(),
): Promise<number> {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await bootstrap(client);
    const applied = await getAppliedMigrations(client);
    const files = listMigrationFiles(migrationsDir);
    const pending = files.filter((f) => !applied.has(f.version));

    for (const file of pending) {
      await applyMigration(client, file);
    }

    return pending.length;
  } finally {
    client.release();
    await pool.end();
  }
}

export async function status(
  databaseUrl: string,
  migrationsDir = getMigrationsDir(),
): Promise<Array<{ version: string; filename: string; appliedAt: Date | null }>> {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await bootstrap(client);
    const files = listMigrationFiles(migrationsDir);
    const { rows } = await client.query<MigrationRecord>(
      'SELECT version, applied_at FROM schema_migrations',
    );
    const appliedMap = new Map(rows.map((r) => [r.version, r.applied_at]));

    return files.map((f) => ({
      version: f.version,
      filename: f.filename,
      appliedAt: appliedMap.get(f.version) ?? null,
    }));
  } finally {
    client.release();
    await pool.end();
  }
}
