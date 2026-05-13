# Requirements: M3 - Tenant Auth

## User stories

- As a business owner, I want to sign up with my email, password, business name, and a unique slug, so that I get a tenant account and can access the dashboard.
- As a business owner, I want to log in with my email and password, so that I receive a token I can use to call authenticated API endpoints.
- As the API, I want every authenticated request to carry the caller's tenant ID in the JWT, so that RLS context can be set without an extra DB lookup.

## Acceptance criteria

- [ ] `POST /auth/signup` creates a tenant and a linked user; returns a signed JWT.
- [ ] `POST /auth/login` verifies credentials and returns a signed JWT.
- [ ] JWT payload contains `sub` (userId), `tenantId`, `iat`, `exp` (7-day expiry).
- [ ] Passwords are stored as bcrypt hashes (work factor 12); plaintext is never persisted or logged.
- [ ] Duplicate email on signup returns 409.
- [ ] Duplicate slug on signup returns 409.
- [ ] Reserved slug on signup returns 422 with `slug_reserved` detail.
- [ ] Wrong password or unknown email on login returns 401 (same message for both — no user enumeration).
- [ ] Invalid or expired JWT on a protected route returns 401.
- [ ] Auth middleware attaches `req.auth = { userId, tenantId }` for downstream handlers.
- [ ] `schedulecore_app` Postgres role exists with minimal privileges; `FORCE ROW LEVEL SECURITY` applied to tenant-scoped tables.
- [ ] All acceptance criteria covered by integration tests against a real Neon branch (see `docs/testing.md`).
