# ADR 004 — Database Provider: Neon (Serverless PostgreSQL)

**Date:** 2026-04-11
**Status:** Accepted

## Context

ScheduleCore is multi-tenant. The database must support PostgreSQL, be cost-efficient at low load, and allow branch-per-environment workflows for safe migrations.

## Decision

Use **Neon** (serverless PostgreSQL) via `@neondatabase/serverless`.

- Connection string from `DATABASE_URL` environment variable.
- `packages/db` exposes a single `createDb()` factory returning a Neon SQL tagged-template client.
- No ORM at this stage — raw SQL only. Add Drizzle if type-safe query building becomes needed (revisit in a separate ADR).
- One Neon project per environment (`dev`, `staging`, `prod`) managed via Terraform (`infra/neon.tf`).

## Consequences

- `fetchConnectionCache = true` reuses HTTP connections across invocations (important for serverless/edge).
- Branching model: create a Neon branch for each PR when running integration tests.
- `DATABASE_URL` must never be committed; always injected via environment or secrets manager.
