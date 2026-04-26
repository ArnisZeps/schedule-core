# ADR 004 — Database Provider: Neon (Serverless PostgreSQL)

**Date:** 2026-04-11
**Status:** Accepted

## Context

ScheduleCore is multi-tenant. The database must support PostgreSQL, be cost-efficient at low load, and allow branch-per-environment workflows for safe migrations.

## Decision

Use **Neon** (serverless PostgreSQL) via `@neondatabase/serverless`.

- Connection string from `DATABASE_URL` environment variable.
- `packages/db` exposes a single `createDb()` factory returning a Neon `Pool` (WebSocket client).
- No ORM at this stage — raw SQL only. Add Drizzle if type-safe query building becomes needed (revisit in a separate ADR).
- One Neon project per environment (`dev`, `staging`, `prod`) managed via Terraform (`infra/neon.tf`).

## Consequences

- `Pool` (WebSocket client) is used instead of the HTTP `neon()` client. The HTTP client's transaction model is non-interactive (array of queries only) and cannot execute `SET LOCAL` before arbitrary async callback logic, which is required for RLS tenant context. `Pool` supports standard async transaction callbacks via `client.query()`.
- Branching model: create a Neon branch for each PR when running integration tests.
- `DATABASE_URL` must never be committed; always injected via environment or secrets manager.
