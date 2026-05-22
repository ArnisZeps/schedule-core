# Domain: Auth

Business owner authentication. Signup creates a tenant and first user. Login issues a JWT stored in an HttpOnly cookie. All owner-facing API routes require this cookie; all tenant-scoped DB queries run inside `withTenantContext` which sets the RLS context.

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

Creates a `tenants` row and first `users` row in a single transaction. Email stored and compared in lowercase. On success, sets the `sc_token` HttpOnly cookie.

**Response 201**
```json
{ "ok": true }
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

On success, sets the `sc_token` HttpOnly cookie.

**Response 200**
```json
{ "ok": true }
```

**Errors**
- `401` `{ "error": "invalid_credentials" }` — same message for unknown email and wrong password (no enumeration)

---

### `POST /api/auth/logout`

Clears the `sc_token` cookie (`Max-Age=0`).

**Response 204** — no body

---

### `sc_token` cookie

- **Name:** `sc_token`
- **HttpOnly, SameSite=Strict, Path=/**
- **Secure** in production only
- **Max-Age** derived from `JWT_EXPIRY` env var (default `30d`)

### JWT payload

```json
{ "sub": "userId", "tenantId": "uuid", "iat": "unix", "exp": "iat + 30 days" }
```

HS256 signed. Non-revocable for 30-day TTL (configurable via `JWT_EXPIRY` env var). Process exits at startup if `JWT_SECRET` is missing.

---

## Server utilities

| File | Responsibility |
|------|----------------|
| `apps/web/middleware.ts` | Edge-compatible middleware. Matches all dashboard routes + `/login` + `/register`. Verifies `sc_token` cookie with `jose`/`jwtVerify` (Edge-safe). Redirects unauthenticated requests to `/login`; redirects authenticated users away from login/register. Injects `x-user-id` and `x-tenant-id` request headers for Server Components. |
| `apps/web/src/lib/server/withAuth.ts` | Reads `sc_token` from `Cookie` header (regex parse). Returns `{ userId, tenantId }` or `null`. Used by all API Route Handlers. |
| `apps/web/src/lib/server/withTenantContext.ts` | Wraps a DB transaction, executes `SET LOCAL app.current_tenant_id = ?` before running queries. Required for all tenant-scoped route handlers and Server Components. |
| `apps/web/src/lib/server/jwt.ts` | `signToken(payload)`, `verifyToken(token)`, and `getTokenMaxAge()` — thin wrappers around `jose`. |
| `apps/web/src/lib/server/password.ts` | `hashPassword(plain)` and `verifyPassword(plain, hash)` — bcrypt, work factor 12. |

---

## Frontend

### Routes

| Route | File | Access |
|-------|------|--------|
| `/login` | `apps/web/app/(auth)/login/page.tsx` | Public |
| `/register` | `apps/web/app/(auth)/register/page.tsx` | Public |

Auth routing is handled by middleware:

- **Unauthenticated → dashboard**: Middleware verifies `sc_token` cookie. Requests to dashboard routes without a valid token redirect to `/login`.
- **Authenticated → auth pages**: Middleware redirects authenticated users away from `/login` and `/register` to `/services`.

### Auth context

```ts
// apps/web/src/context/AuthContext.tsx
interface User { userId: string; tenantId: string }
interface AuthContextValue {
  user: User | null
  logout(): void
}

// apps/web/src/components/UserProvider.tsx — Client Component
// Accepts user prop from Server Component layout; provides AuthContext.
// logout() calls POST /api/auth/logout then router.replace('/login')
function UserProvider({ user, children }: { user: { userId: string; tenantId: string }; children: ReactNode })

// apps/web/src/hooks/useAuth.ts
function useAuth(): AuthContextValue  // throws if used outside AuthContext provider

// apps/web/src/lib/api.ts
class ApiError extends Error { constructor(public status: number, message: string) {} }
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T>
// Base URL: process.env.NEXT_PUBLIC_API_URL ?? '/api'
// No Authorization header — relies on sc_token cookie (credentials: 'include')
// Throws ApiError on non-2xx; redirects to /login on 401
```

### Key components

| File | Responsibility |
|------|----------------|
| `apps/web/src/components/UserProvider.tsx` | Client Component. Receives `user` prop from the dashboard Server Component layout. Provides `AuthContext`. `logout()` calls `POST /api/auth/logout` then redirects to `/login`. |
| `apps/web/app/(dashboard)/layout.tsx` | Async Server Component. Reads `x-user-id`/`x-tenant-id` headers injected by middleware. Renders `<UserProvider>` and `<AppLayout>`. |
| `apps/web/src/page-components/LoginPage.tsx` | Email + password form → `POST /api/auth/login` → cookie set server-side → redirect to `/services`. On 401, displays "Incorrect email or password." inline without page reload. Any other error shows "Login failed". |
| `apps/web/src/page-components/RegisterPage.tsx` | Business name, slug, email, password form → `POST /api/auth/signup` → cookie set server-side → redirect to `/services`. |

## Constraints

- JWT transport changed from `localStorage` to HttpOnly cookie (ADR-012). Eliminates XSS token-theft risk.
- No token refresh or revocation. Users re-login after 30-day expiry (configurable via `JWT_EXPIRY`).
- `users` table has no RLS — platform-level. Login looks up by email without tenant context.
- Multiple users per tenant are schema-supported but not exposed via UI (post-MVP).
- Middleware uses `jose` (not `jsonwebtoken`) for Edge runtime compatibility.
