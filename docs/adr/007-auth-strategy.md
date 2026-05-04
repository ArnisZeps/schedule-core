# ADR 007 — Auth Strategy: JWT Stateless + bcrypt

**Date:** 2026-04-15
**Status:** Accepted

## Context

M3 requires sign-up and login for business owners (tenant admins). The roadmap
explicitly resolved the auth strategy question as "JWT stateless" (no session
+ Redis). This ADR records the full decision, including password hashing,
token lifecycle, and the Postgres non-owner role deferred from ADR-005.

## Decision

### Authentication mechanism — stateless JWT

Issue a signed JWT on login/signup. The API is stateless: no server-side session
store, no Redis. The JWT carries the identity needed to resolve tenant context.

- **Algorithm:** HS256 with a secret from `JWT_SECRET` env var (minimum 32 bytes).
- **Payload:** `{ sub: userId, tenantId, iat, exp }`.
- **Expiry:** 7 days for MVP. No refresh token workflow in scope.
- **Transport:** `Authorization: Bearer <token>` header only. No cookies.

Refresh tokens were rejected for MVP — they require a token store (defeating
statelessness or adding Redis) and add client-side complexity not yet needed.

### Password hashing — bcrypt

Use `bcryptjs` (pure-JS, no native addon). Work factor 12.

`argon2` was considered but rejected: native bindings cause platform/CI friction,
and bcrypt at factor 12 is adequate for the expected load.

### Postgres non-owner application role

ADR-005 deferred creating a non-owner role to M3. This milestone delivers it.

- Role name: `schedulecore_app`.
- Granted: `SELECT`, `INSERT`, `UPDATE`, `DELETE` on `tenants`, `users`,
  `services`, `availability_rules`, `bookings`, `schema_migrations`.
- Granted: `USAGE` on all sequences.
- The API connects as `schedulecore_app` in staging and production
  (`DATABASE_URL` points to a connection string for this role).
- `FORCE ROW LEVEL SECURITY` is applied to `services`, `availability_rules`,
  and `bookings` so the owner role also cannot bypass RLS.
- The `tenants` and `users` tables have no RLS (platform-level; access control
  is at the application layer).

## Consequences

- `JWT_SECRET` must never be committed; injected via environment / secrets manager.
- All tenant-scoped API routes must call `SET LOCAL app.current_tenant_id = ?`
  inside a transaction before executing tenant-scoped queries. Auth middleware
  attaches `tenantId` to `req`; each route handler is responsible for setting
  the RLS context in its DB transaction.
- `bcryptjs` and `jsonwebtoken` added as runtime dependencies to `apps/api`.
  `zod` also added for request validation (anticipated in ADR-002).
- A `0002_tenant_auth.sql` migration creates the `users` table, the
  `schedulecore_app` role, and applies `FORCE ROW LEVEL SECURITY`.
- Revoking a session requires waiting for token expiry (7-day window). A
  token blocklist is not in scope for MVP.
