# Design: M2 — Migration Tooling

## Problem

M1 delivered a static `schema.sql`. There is no mechanism to version, track, or
incrementally apply schema changes across dev, staging, and prod. Tests recreate
the schema destructively on every run; environments have no record of what has
been applied. Any DDL change has no safe delivery mechanism.

## Components

| File | Responsibility |
|------|----------------|
| `packages/db/migrations/0001_initial_schema.sql` | First migration — full baseline schema |
| `packages/db/src/migrator.ts` | Core runner: reads migration files, checks `schema_migrations`, applies pending ones |
| `packages/db/src/migrate.ts` | CLI entry point — parses `argv`, calls migrator, exits with code |
| `packages/db/src/migrator.test.ts` | Integration tests for the runner itself |
| `packages/db/src/schema.test.ts` | Updated to call `migrate()` instead of loading `schema.sql` directly |

## Contracts

### `schema_migrations` table

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT        PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

No RLS. No `tenant_id`. Created by the migrator as its first action (`bootstrap()`).
The `version` value is the 4-digit prefix of the filename (e.g. `'0001'`).

### Migration file convention

- Location: `packages/db/migrations/`
- Naming: `NNNN_snake_case_description.sql` (e.g. `0001_initial_schema.sql`)
- Lexicographic sort on filename = correct execution order
- Each file contains plain SQL; executed as a single multi-statement query inside
  a transaction together with the `schema_migrations` INSERT

### `migrator.ts` exports

```typescript
interface MigrationFile { version: string; filename: string; path: string; }

getMigrationsDir(): string
listMigrationFiles(migrationsDir: string): MigrationFile[]
bootstrap(client: PoolClient): Promise<void>
getAppliedMigrations(client: PoolClient): Promise<Set<string>>
applyMigration(client: PoolClient, migration: MigrationFile): Promise<void>
migrate(databaseUrl: string): Promise<number>   // returns count applied
status(databaseUrl: string): Promise<Array<{ version: string; filename: string; appliedAt: Date | null }>>
```

`migrate()` and `status()` accept a `databaseUrl` parameter (not `process.env`)
so they are testable and callable from both the CLI and the test suite.

### CLI commands (`migrate.ts`)

| Command | Action |
|---------|--------|
| `up` | Apply all pending migrations; exit 0 |
| `status` | Print table of all migrations with applied/pending state and timestamp |

Rollback is out of scope — recovery is a new forward migration.

## Neon branch CI workflow

Each PR integration test run:
1. Create a Neon branch from `test-seed` (empty DB) via the Neon API
2. Set `TEST_DATABASE_URL` to the branch connection string
3. Run `pnpm --filter @schedule-core/db migrate:up`
4. Run `pnpm --filter @schedule-core/db test`
5. Delete the branch (in `finally` step)

Secrets required: `NEON_API_KEY`, `NEON_PROJECT_ID`.
GitHub Actions YAML is deferred to a future CI milestone.

## Rejected alternatives

**`node-pg-migrate`** — requires the `pg` driver. Neon serverless uses its own
WebSocket-based driver; bridging via the Pool compatibility shim introduces a
second connection mode that is inconsistent with the rest of the codebase.

**Umzug** — framework-agnostic but JS-centric. Consuming plain `.sql` files
requires writing a custom storage adapter, which amounts to building the runner
yourself anyway — for ~130 KB of additional deps.

Both alternatives add external dependencies without adding meaningful capability
over the ~150-line custom runner that can use the existing `@neondatabase/serverless`
`Pool` already present in `packages/db`.

## Trade-offs accepted

- No rollback command in MVP. Rollback is a new forward migration when needed.
  Postgres supports transactional DDL so a bad migration can be reverted via a
  corrective migration file.
- `schema.sql` is retained alongside `migrations/` during M2 for reference;
  it will be deleted in a subsequent cleanup once tests are fully migrated.

## Out of scope

- `down` / rollback migrations
- Dry-run mode
- Migration squashing
- `create <name>` scaffolding helper
- GitHub Actions CI wiring (documented above; implemented later)

## Edge cases

- **Syntax error in migration file**: transaction is rolled back; version is not
  inserted into `schema_migrations`; CLI exits non-zero with the Postgres error.
- **`schema_migrations` already exists**: `CREATE TABLE IF NOT EXISTS` is a no-op.
- **Missing `DATABASE_URL`**: CLI fails immediately before opening any connection.
- **Non-sequential numbering** (e.g. `0001`, `0003`): allowed — runner applies
  whatever is pending in lexicographic order.
- **Re-entrant `migrate:up`**: idempotent; only pending versions are applied.
