# Requirements: M2 — Migration Tooling

## User stories

- As an engineer, I want to run all pending migrations with a single command,
  so that any environment (dev, staging, prod) can reach the current schema state.
- As an engineer, I want to see which migrations have and have not been applied,
  so that I can reason about the state of any database.
- As a CI process, I want migrations to run idempotently against a fresh Neon branch,
  so that PR integration tests always start from a known schema state.

## Acceptance criteria

- [ ] `pnpm --filter @schedule-core/db migrate:up` applies all pending migrations in
      sequence and exits 0.
- [ ] Running `migrate:up` on an already-migrated database is a no-op (exits 0,
      reports 0 migrations applied).
- [ ] `pnpm --filter @schedule-core/db migrate:status` prints all migrations with
      applied/pending state and timestamp when applied.
- [ ] A failed migration causes a non-zero exit and leaves `schema_migrations`
      unchanged for that version (transaction rollback).
- [ ] Migration files follow the naming convention `NNNN_description.sql`
      (zero-padded 4-digit sequence number).
- [ ] The `schema_migrations` table has no RLS (per ADR-005).
- [ ] Existing integration tests in `schema.test.ts` continue to pass after
      the test setup is migrated to use the runner.
