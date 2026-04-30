import { vi } from 'vitest';
import { withTenantContext } from './tenant-context.js';

function makePool(onQuery?: (sql: string, params?: unknown[]) => void) {
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      onQuery?.(sql, params);
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client) };
  return { pool, client };
}

describe('withTenantContext', () => {
  it('runs SET LOCAL as the first query inside a transaction', async () => {
    const calls: string[] = [];
    const { pool, client } = makePool((sql) => calls.push(sql));

    await withTenantContext(pool as any, 'tenant-abc', async () => {});

    expect(calls[0]).toBe('BEGIN');
    expect(calls[1]).toMatch(/set_config\('app\.current_tenant_id'/);
    expect(client.query.mock.calls[1][1]).toEqual(['tenant-abc']);
  });

  it('commits after the callback succeeds', async () => {
    const calls: string[] = [];
    const { pool } = makePool((sql) => calls.push(sql));

    await withTenantContext(pool as any, 'tenant-abc', async () => {});

    expect(calls.at(-1)).toBe('COMMIT');
  });

  it('releases the client after commit', async () => {
    const { pool, client } = makePool();
    await withTenantContext(pool as any, 'tenant-abc', async () => {});
    expect(client.release).toHaveBeenCalled();
  });

  it('returns the value from the callback', async () => {
    const { pool } = makePool();
    const result = await withTenantContext(pool as any, 'tenant-abc', async () => 42);
    expect(result).toBe(42);
  });

  it('rolls back and releases on error, then rethrows', async () => {
    const calls: string[] = [];
    const { pool, client } = makePool((sql) => calls.push(sql));

    await expect(
      withTenantContext(pool as any, 'tenant-abc', async () => {
        throw new Error('db error');
      }),
    ).rejects.toThrow('db error');

    expect(calls).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
