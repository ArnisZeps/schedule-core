# Design: api-nextjs-migration

## Problem

`apps/api` (Express) and `apps/web` (Next.js) are two separate processes. Running them requires two terminals and two ports in development. Deploying them requires two hosted services. M7 (public booking widget) will live at `apps/web/app/(public)/book/[slug]/` as a Server Component, but its data comes from `apps/api` over HTTP — a cross-process call that could be a direct function call.

Consolidating into a single Next.js app eliminates CORS configuration, simplifies deployment, and makes M7 API work live alongside its UI.

**ADR-010 constraint lifted:** ADR-010 stated "API and CORS unchanged; Express handles all API traffic." ADR-011 supersedes this.

---

## Route Handler structure

All handlers go under `apps/web/app/api/`. The URL prefix changes from `:3001/` to `/api/`.

```
app/api/
  health/route.ts
  auth/
    signup/route.ts
    login/route.ts
  tenants/
    route.ts                           ← POST (create tenant)
    [tenantId]/
      route.ts                         ← GET, PATCH
      services/
        route.ts                       ← GET, POST
        [serviceId]/
          route.ts                     ← GET, PATCH, DELETE
          slots/route.ts               ← GET
          availability-rules/
            route.ts                   ← GET, POST
            [ruleId]/route.ts          ← DELETE
      bookings/
        route.ts                       ← GET, POST
        [bookingId]/route.ts           ← PATCH
      staff/
        route.ts                       ← GET, POST
        [staffId]/
          route.ts                     ← GET, PATCH, DELETE
          services/route.ts            ← GET, PUT
          schedules/route.ts           ← GET, PUT
          overrides/
            route.ts                   ← GET, POST
            [overrideId]/route.ts      ← PATCH, DELETE
  public/
    [tenantSlug]/
      services/[serviceId]/slots/route.ts   ← GET
      bookings/route.ts                     ← POST
```

---

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/**/route.ts` | Route Handlers — HTTP method exports (`GET`, `POST`, `PATCH`, `DELETE`). Direct ports of Express route handlers. |
| `apps/web/src/lib/server/withAuth.ts` | Extracts and verifies the Bearer token from a `Request`. Returns `{ userId, tenantId }` or `null`. Replaces `apps/api/src/middleware/auth.ts`. |
| `apps/web/src/lib/server/withTenantContext.ts` | Moved from `apps/api/src/middleware/tenant-context.ts`. Already a plain utility — no Express dependency. Unchanged. |
| `apps/web/src/lib/server/jwt.ts` | Moved from `apps/api/src/lib/jwt.ts`. Sign/verify HS256 JWT. Unchanged. |
| `apps/web/src/lib/server/password.ts` | Moved from `apps/api/src/lib/password.ts`. bcryptjs wrapper. Unchanged. |
| `apps/web/src/lib/server/availability.ts` | Moved from `apps/api/src/lib/availability.ts`. Slot/overlap logic. Unchanged. |
| `apps/web/src/lib/server/db.ts` | Module-level Neon Pool singleton. Replaces the `(pool: Pool) => Router` factory pattern. |

> **Server-only rule:** Files under `apps/web/src/lib/server/` must never be imported from Client Components or `apps/web/src/lib/api.ts`. They run exclusively in Route Handlers.

---

## Contracts

### URL base change

| Before | After |
|--------|-------|
| `http://localhost:3001/auth/login` | `/api/auth/login` |
| `http://localhost:3001/tenants/:id/services` | `/api/tenants/:id/services` |
| `http://localhost:3001/public/:slug/bookings` | `/api/public/:slug/bookings` |

**Client change:** `NEXT_PUBLIC_API_URL` in `.env.local` changes from `http://localhost:3001` to `/api`. No changes to `apiFetch()` call sites.

### Request/Response translation

Each Express handler `(req, res) => void` becomes an async function returning `Response`:

| Express | Route Handler |
|---------|--------------|
| `req.body` | `await request.json()` |
| `req.params.x` | `params.x` (from `{ params }` arg) |
| `req.query.x` | `new URL(request.url).searchParams.get('x')` |
| `res.json(data)` | `Response.json(data)` |
| `res.status(x).json(data)` | `Response.json(data, { status: x })` |
| `req.auth!.tenantId` | `auth.tenantId` (from `withAuth(request)`) |

### Auth pattern

```typescript
// Each protected handler
export async function GET(request: Request, { params }) {
  const auth = withAuth(request)
  if (!auth) return Response.json({ message: 'Unauthorized' }, { status: 401 })
  // ...
}
```

### DB singleton

```typescript
// apps/web/src/lib/server/db.ts
import { createDb } from '@schedule-core/db'
export const db = createDb()
```

Used directly in route handlers instead of the injected `pool` from the Express factory pattern.

### Rate limiter

The in-memory `Map` in `public.ts` is **removed**. A `// TODO: add Upstash Rate Limit before M7` comment replaces it. Recommended replacement: `@upstash/ratelimit` + `@upstash/redis`. This is tracked as a separate task but is not blocking — the public endpoint has no live traffic until M7.

### CORS

Removed. Web and API are same-origin. No `ALLOWED_ORIGINS` env var. No CORS middleware.

---

## Rejected alternatives

**Keep Express as a separate service** — works today but adds cross-process latency for M7 Server Component data fetching, requires two deployments, and requires CORS configuration forever.

**Edge runtime for Route Handlers** — rejected. bcryptjs and jsonwebtoken require Node.js crypto APIs. The Neon WebSocket Pool requires Node.js `ws`. Edge runtime is incompatible with all three.

**Next.js `middleware.ts` for auth** — rejected. Would require JWT in a `httpOnly` cookie, contradicting ADR-007. Not in scope.

**Keep Express factory pattern** — passing `db` as an argument to every route module. Rejected in favour of a module-level singleton — the factory pattern was Express-specific and adds no value in Route Handlers where each module is a file, not a function.

---

## Trade-offs accepted

- More files: 8 Express routers become ~25 Route Handler files (one per URL segment group). More granular, easier to navigate.
- Rate limiter temporarily absent from the public endpoint. Accepted because the public endpoint has no live clients until M7.
- `apps/api` deleted — no rollback path without version control.

---

## Out of scope

- Rate limiter replacement (Upstash) — tracked as a pre-M7 task, not part of this migration.
- CORS headers for `/api/public/*` — added only if external (non-iframe) API access is needed.
- Converting `apps/api` supertest tests to Route Handler equivalents — existing MSW-based web tests provide adequate coverage.
- M7 public booking UI — this migration sets up the API foundation; M7 builds on it.

---

## Edge cases

- **Tenant ID mismatch:** Each protected route still validates that `auth.tenantId === params.tenantId`. Same as current Express handlers.
- **Empty `DATABASE_URL`:** The `db` singleton will throw at startup. Same behaviour as current Express startup.
- **`bcryptjs` bundling:** Next.js may attempt to bundle `bcryptjs`. If it fails, add `serverExternalPackages: ['bcryptjs', 'jsonwebtoken']` to `next.config.ts`.
- **Missing `JWT_SECRET`:** `jwt.ts` asserts the env var on import. The Route Handler module will throw during cold start if absent. Same fail-fast behaviour as Express.
