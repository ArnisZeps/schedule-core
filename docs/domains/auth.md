# Domain: Auth

Business owner authentication. Signup creates a tenant and first user. Login issues a JWT. All owner-facing API routes require this JWT; all tenant-scoped DB queries run inside `withTenantContext` which sets the RLS context.

## Schema

Tables: `tenants`, `users` — see [data-model.md](../db/data-model.md).

## API

### `POST /api/auth/signup`

**Request**
```json
{
  "email": "string",
  "password": "string (min 8 chars)",
  "businessName": "string",
  "slug": "string (lowercase alphanumeric + hyphens, 3–50 chars)"
}
```

Creates a `tenants` row and first `users` row in a single transaction. Email stored and compared in lowercase.

**Response 201**
```json
{ "token": "<jwt>" }
```

**Errors**
- `409` `{ "error": "email_taken" }`
- `409` `{ "error": "slug_taken" }`
- `422` `{ "error": "validation_error", "details": [...] }` — includes `"slug_reserved"` when slug collides with reserved paths: `api`, `auth`, `admin`, `login`, `logout`, `signup`, `dashboard`, `app`, `www`, `mail`, `support`, `help`, `static`, `assets`

---

### `POST /api/auth/login`

**Request**
```json
{ "email": "string", "password": "string" }
```

**Response 200**
```json
{ "token": "<jwt>" }
```

**Errors**
- `401` `{ "error": "invalid_credentials" }` — same message for unknown email and wrong password (no enumeration)

---

### JWT payload

```json
{ "sub": "userId", "tenantId": "uuid", "iat": "unix", "exp": "iat + 30 days" }
```

HS256 signed. Non-revocable for 30-day TTL (configurable via `JWT_EXPIRY` env var). Process exits at startup if `JWT_SECRET` is missing.

---

## Server utilities

| File | Responsibility |
|------|----------------|
| `apps/web/src/lib/server/withAuth.ts` | Reads `Authorization: Bearer <token>`. On success sets `req.auth = { userId, tenantId }`. Returns 401 before reaching the handler on failure. |
| `apps/web/src/lib/server/withTenantContext.ts` | Wraps a DB transaction, executes `SET LOCAL app.current_tenant_id = ?` before running queries. Required for all tenant-scoped route handlers. |
| `apps/web/src/lib/server/jwt.ts` | `signToken(payload)` and `verifyToken(token)` — thin wrappers around `jose`. |
| `apps/web/src/lib/server/password.ts` | `hashPassword(plain)` and `verifyPassword(plain, hash)` — bcrypt, work factor 12. |

---

## Frontend

### Routes

| Route | File | Access |
|-------|------|--------|
| `/login` | `apps/web/app/(auth)/login/page.tsx` | Public |

Auth routing is bidirectional:

- **Unauthenticated → dashboard**: `apps/web/app/(dashboard)/layout.tsx` guards all dashboard routes. Returns `null` until hydrated; redirects to `/login` via `router.replace` whenever `user` is null after hydration. Children are unmounted the instant `user` becomes null.
- **Authenticated → public pages**: `apps/web/src/components/UnauthenticatedOnly.tsx` wraps the content of `/` (marketing page) and `/login`. It returns `null` until hydrated and `null` when `user` is non-null (redirecting to `/services`), so a logged-in user never sees public-page content.

### Interfaces

```ts
// apps/web/src/context/AuthContext.tsx
interface User { userId: string; tenantId: string; exp: number }
interface IAuthContext {
  user: User | null
  token: string | null
  login(token: string): void
  logout(): void
}

// apps/web/src/hooks/useAuth.ts
function useAuth(): IAuthContext  // throws if used outside AuthContext provider

// apps/web/src/lib/api.ts
class ApiError extends Error { constructor(public status: number, message: string) {} }
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T>
// Base URL: process.env.NEXT_PUBLIC_API_URL ?? '/api'
// Injects Authorization: Bearer <token> from localStorage
// Throws ApiError on non-2xx; redirects to /login on 401
```

### Key components

| File | Responsibility |
|------|----------------|
| `apps/web/src/context/AuthContext.tsx` | Reads/writes JWT in `localStorage`; decodes payload client-side (no sig verify — API enforces). Exposes `user`, `token`, `login`, `logout`. |
| `apps/web/src/page-components/LoginPage.tsx` | Email + password form → `POST /api/auth/login` → `login(token)` → redirect to `/appointments`. |

## Constraints

- JWT in `localStorage` — XSS risk accepted for MVP. Cookie-based auth is a post-MVP hardening task.
- No token refresh or revocation. Users re-login after 30-day expiry (configurable via `JWT_EXPIRY`).
- `users` table has no RLS — platform-level. Login looks up by email without tenant context.
- Multiple users per tenant are schema-supported but not exposed via UI (post-MVP).
