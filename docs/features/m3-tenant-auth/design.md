# Design: M3 - Tenant Auth

## Problem

Business owners need to register and authenticate before managing their tenant.
No auth layer exists yet, and the Postgres non-owner app role (deferred from
ADR-005) must also be introduced here so that RLS is actually enforced in
non-development environments.

Constraints:
- JWT stateless (resolved in roadmap; ADR-007).
- Raw SQL, no ORM (ADR-004).
- Express, no decorator magic (ADR-002).
- Non-owner Postgres role required before RLS is meaningful (ADR-005).

## Data model addition

### `users` table (new)

No RLS — platform-level auth table, analogous to `tenants`.

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| tenant_id | UUID | NOT NULL, FK → tenants(id) ON DELETE CASCADE |
| email | TEXT | NOT NULL, UNIQUE |
| password_hash | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

**Index:** `(email)` — login lookup.

Multiple users per tenant are supported. Signup creates the first user (the owner). Additional users can be added in a later milestone — the schema does not need to change.

## Components

| File | Responsibility |
|------|----------------|
| `packages/db/migrations/0002_tenant_auth.sql` | Add `users` table; create `schedulecore_app` role with minimal grants; `FORCE ROW LEVEL SECURITY` on tenant-scoped tables |
| `apps/api/src/routes/auth.ts` | `POST /auth/signup` and `POST /auth/login` handlers |
| `apps/api/src/middleware/auth.ts` | JWT verification; attaches `req.auth = { userId, tenantId }` |
| `apps/api/src/middleware/tenant-context.ts` | Helper: wraps a DB transaction and executes `SET LOCAL app.current_tenant_id = ?` before running queries |
| `apps/api/src/lib/jwt.ts` | `signToken(payload)` and `verifyToken(token)` thin wrappers around `jsonwebtoken` |
| `apps/api/src/lib/password.ts` | `hashPassword(plain)` and `verifyPassword(plain, hash)` wrappers around `bcryptjs` |

## Contracts

### `POST /auth/signup`

**Request**
```
{
  "email": string,
  "password": string,       // min 8 chars
  "businessName": string,
  "slug": string            // lowercase alphanumeric + hyphens, 3–50 chars
}
```

**Response 201**
```
{ "token": "<jwt>" }
```

**Errors**
- 409 `{ "error": "email_taken" }` — email already registered
- 409 `{ "error": "slug_taken" }` — slug already in use
- 422 `{ "error": "validation_error", "details": [...] }` — malformed input

### `POST /auth/login`

**Request**
```
{ "email": string, "password": string }
```

**Response 200**
```
{ "token": "<jwt>" }
```

**Errors**
- 401 `{ "error": "invalid_credentials" }` — unknown email or wrong password (same message, no enumeration)

### JWT payload

```
{ sub: userId, tenantId, iat, exp }   // exp = iat + 7 days
```

### Auth middleware

Reads `Authorization: Bearer <token>`. On success, sets `req.auth = { userId: string, tenantId: string }`.
On failure, returns 401 before reaching the route handler.

### `withTenantContext(db, tenantId, fn)` helper

Wraps `fn` in a DB transaction, executes `SET LOCAL app.current_tenant_id = ?`
first. Used by all tenant-scoped route handlers in M4+.

## Rejected alternatives

**Session + Redis** — rejected by roadmap decision. Adds a stateful dependency
and operational overhead not warranted at this stage.

**`argon2`** — rejected in ADR-007. Native bindings cause platform/CI friction;
bcrypt factor 12 is adequate.

**`jsonwebtoken` RS256** — asymmetric signing is useful when external parties
verify tokens. Nothing outside this API verifies tokens in MVP; HS256 + a
strong secret is simpler.

**Storing token in a cookie** — rejected. Bearer header is simpler for a pure
API; cookies add CSRF surface area with no benefit until a browser-rendered page
needs session persistence.

**`users` with RLS** — login looks up by email without a tenant context, which
would return zero rows under RLS. Keeping `users` as a platform-level table
(no RLS) avoids a chicken-and-egg problem at auth time. Access is controlled
at the application layer for auth routes.

## Trade-offs accepted

- **7-day non-revocable tokens.** Revoking a compromised token requires waiting
  for expiry. A blocklist would require a store (Redis or a DB table) and defeats
  statelessness. Acceptable for MVP given the low user count.

## Out of scope

- Refresh tokens
- Email verification
- Password reset flow
- OAuth / social login
- Adding users to an existing tenant (M3 only creates the first user at signup)
- Token revocation / blocklist

## Edge cases

- Signup and login email comparisons must be case-insensitive. Store and compare
  in lowercase.
- Slug validation must reject slugs that collide with reserved platform paths.
  Reserved list (checked before the DB uniqueness check):
  `api`, `auth`, `admin`, `login`, `logout`, `signup`, `dashboard`, `app`,
  `www`, `mail`, `support`, `help`, `static`, `assets`.
  Returns 422 `{ "error": "validation_error", "details": ["slug_reserved"] }`.
- Concurrent signup with the same email/slug: rely on the DB unique constraint;
  catch the constraint violation and return 409.
- `JWT_SECRET` missing at startup: the process must exit immediately with a clear
  error message rather than silently using an empty/default secret.
