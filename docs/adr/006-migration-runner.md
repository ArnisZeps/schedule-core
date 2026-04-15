# ADR 006 — Migration Runner: Custom SQL-file Runner

**Date:** 2026-04-15
**Status:** Accepted

## Context

M1 delivered a static `schema.sql` as the baseline schema. The project needs a
versioned migration system to safely deliver incremental DDL changes to dev,
staging, and prod. Any chosen runner must:

- Work with the Neon serverless PostgreSQL driver (`@neondatabase/serverless`)
  already in use — no second DB connection mode
- Execute plain SQL files (ADR-004: no ORM, raw SQL only)
- Track applied migrations in the database
- Run inside transactions so a failed migration is fully rolled back
- Introduce no unnecessary new runtime dependencies (CLAUDE.md rule)

## Decision

Use a **custom SQL-file migration runner** built directly on
`@neondatabase/serverless` `Pool` (WebSocket mode).

Migration files live in `packages/db/migrations/` named `NNNN_description.sql`.
A `schema_migrations` table (no RLS) tracks applied versions. The runner is
~150 lines of TypeScript with zero new runtime dependencies.

## Considered alternatives

**`node-pg-migrate`**
Rejected. Requires the `pg` driver as a peer dependency. The Neon serverless
driver is not `pg`; bridging via the `Pool` compatibility shim works but forces
a second connection mode that is inconsistent with the rest of the codebase and
adds `pg` as a transitive dependency. The library also ships features
(rollback migrations, JS migration files, lock table) that are out of scope for
MVP and add surface area.

**Umzug**
Rejected. Designed around JavaScript migration files. Consuming plain `.sql`
files requires writing a custom `MigrationStorage` adapter, which amounts to
building the runner from scratch anyway — at the cost of ~130 KB of additional
deps and an extra abstraction layer.

## Consequences

- Migration files are plain SQL in `packages/db/migrations/` named
  `NNNN_snake_case_description.sql`.
- `schema_migrations` table tracks applied versions with timestamps. No RLS on
  this table (per ADR-005 — it is platform-level infrastructure, not tenant data).
- Each migration runs inside a `BEGIN` / `COMMIT` block. The `schema_migrations`
  INSERT is inside the same transaction, so a failed migration is never recorded
  as applied.
- No rollback (`down`) command in MVP. Recovery is a new forward migration.
  Postgres supports transactional DDL so corrective migrations are safe.
- `tsx` is added as a devDependency to `packages/db` to run the CLI script
  without a compile step. This is the only new dependency introduced by M2.
- CI workflow: create a Neon branch per PR, run `migrate:up`, run integration
  tests, delete the branch. GitHub Actions wiring is deferred to a future
  CI milestone.
