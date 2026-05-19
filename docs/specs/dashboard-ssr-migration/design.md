# Design: Dashboard SSR Migration

## Problem

Two related issues motivate this migration:

1. **Empty loading states.** Reference data (staff, services, locations) is fetched client-side
   after hydration. Every navigation shows empty dropdowns and skeletons for ~100–300 ms because
   React Query has no cached data on mount.

2. **XSS token exposure.** JWT in `localStorage` is readable by any JS on the page. The auth
   domain doc accepted this for MVP; the codebase is still small enough to migrate cleanly.

**ADR conflicts (both superseded by ADR-012):**
- ADR-007 transport: "Bearer header only. No cookies." → superseded.
- ADR-010 dashboard: "Client Components, behaviour identical to SPA." → superseded.

---

## Architecture overview

The migration has two phases that must be completed in order:

```
Phase 1: Cookie auth (prerequisite — server can't read auth without this)
Phase 2: Server Component pages (depends on Phase 1)
```

### Phase 1 — Cookie-based auth

**Auth API routes** (`apps/web/app/api/auth/login/route.ts`, `signup/route.ts`):
- Sign the JWT as before (ADR-007 payload + HS256 unchanged).
- Set `Set-Cookie: sc_token=<jwt>; HttpOnly; SameSite=Strict; Path=/; Max-Age=<JWT_EXPIRY_SECONDS>`.
- Omit `Secure` when `NODE_ENV !== 'production'` (HTTP localhost dev).
- Remove `{ token }` from response body. Response body becomes `{ ok: true }` or empty.

**New route** `apps/web/app/api/auth/logout/route.ts`:
- `POST`: clears cookie with `sc_token=; HttpOnly; Max-Age=0`.

**`withAuth.ts`**:
- Reads `request.cookies.get('sc_token')?.value` instead of `Authorization` header.
- Interface unchanged: sets `req.auth = { userId, tenantId }`.

**`apiFetch` (`apps/web/src/lib/api.ts`)**:
- Remove `localStorage.getItem('sc_token')` and `Authorization` header injection.
- Simplifies to: fetch with credentials, throw `ApiError` on non-2xx, redirect to `/login` on 401.

**Next.js middleware** (`apps/web/middleware.ts`):
- Matches `/(dashboard)/**` paths.
- Reads `sc_token` cookie, verifies JWT (same `verifyToken` from `lib/server/jwt.ts`).
- Unauthenticated: `NextResponse.redirect('/login')`.
- Authenticated: forwards decoded `userId` and `tenantId` as `x-user-id` / `x-tenant-id` request
  headers so Server Components can read them without re-decoding the JWT.

**`AuthContext` + `UserProvider`**:

```
apps/web/src/context/AuthContext.tsx  ← interface unchanged (useAuth() stays the same)
apps/web/src/components/UserProvider.tsx  ← new Client Component; receives user prop from layout
```

`UserProvider` accepts `user: { userId: string; tenantId: string }` as a prop (from the Server
Component layout), sets it into `AuthContext`. Replaces `AuthProvider` (which currently reads
localStorage).

**Dashboard `layout.tsx`** (`apps/web/app/(dashboard)/layout.tsx`):
- Becomes a **Server Component** (remove `'use client'`).
- Reads `x-user-id` + `x-tenant-id` from `headers()` (injected by middleware).
- Renders `<UserProvider user={user}><AppLayout>{children}</AppLayout></UserProvider>`.
- The `useEffect` hydration guard is removed (middleware handles the redirect).

**`LoginPage` / `RegisterPage`**:
- Remove `login(token)` calls and localStorage token handling.
- On success: `router.push('/services')` (cookie already set by the API response).

**`UnauthenticatedOnly.tsx`** (redirects logged-in users away from `/login`):
- Loses the `user` check from `useAuth()` (which previously decoded localStorage).
- With middleware, a logged-in user visiting `/login` won't be redirected server-side (middleware
  only guards dashboard routes). Keep the client-side redirect via `useAuth()` intact — it still
  works because `UserProvider` is in the dashboard layout, not the auth layout. Alternatively,
  add a separate middleware check for `/login` + `/register`.

### Phase 2 — Server Component pages

Each dashboard page follows the same pattern:

```tsx
// apps/web/app/(dashboard)/services/page.tsx
import { headers } from 'next/headers'
import { db } from '@/lib/server/db'
import { withTenantContext } from '@/lib/server/withTenantContext'
import { ServicesPage } from '@/page-components/ServicesPage'

export default async function Page() {
  const tenantId = (await headers()).get('x-tenant-id')!
  const services = await withTenantContext(db, tenantId, client =>
    client.query('SELECT ...').then(r => r.rows)
  )
  return <ServicesPage initialServices={services} />
}
```

**Client Component page components** (`ServicesPage`, `AppointmentsPage`, etc.):
- Accept `initial*` props.
- Pass as `initialData` to React Query hooks, so mutations trigger re-fetches against the
  already-warm cache and the UI stays reactive.
- No structural changes to the interactive components (forms, calendar, toolbar).

**React Query** is kept for:
- Mutations (`useCancelBooking`, `useCreateService`, etc.) — these are client-initiated.
- Client-side re-fetching after mutations (cache invalidation stays as-is).
- `initialData` populated from server-fetched props — prevents redundant fetches on mount.

**Data access**: Server Components call `withTenantContext` directly (same as Route Handlers).
No new abstraction layer is introduced — the existing DB + RLS pattern (ADR-004, ADR-005) is
reused unchanged.

---

## Components changed

| File | Change |
|------|--------|
| `apps/web/app/api/auth/login/route.ts` | Set HttpOnly cookie; remove `{ token }` from response |
| `apps/web/app/api/auth/signup/route.ts` | Same |
| `apps/web/app/api/auth/logout/route.ts` | New — clears cookie |
| `apps/web/src/lib/server/withAuth.ts` | Read cookie instead of Authorization header |
| `apps/web/src/lib/api.ts` | Remove localStorage + Authorization header injection |
| `apps/web/middleware.ts` | New — guards dashboard routes, injects user headers |
| `apps/web/src/components/UserProvider.tsx` | New Client Component — replaces AuthProvider |
| `apps/web/src/context/AuthContext.tsx` | Remove localStorage read/write; accept prop-driven user |
| `apps/web/app/(dashboard)/layout.tsx` | Server Component; reads headers, renders UserProvider |
| `apps/web/app/(dashboard)/*/page.tsx` (×4) | Async Server Components; fetch data, pass as props |
| `apps/web/src/page-components/*.tsx` (×4) | Accept `initial*` props; pass to React Query hooks |
| `apps/web/src/page-components/LoginPage.tsx` | Remove `login(token)` |
| `apps/web/src/page-components/RegisterPage.tsx` | Remove `login(token)` |
| `apps/web/src/test/handlers.ts` | Cookie-based auth in MSW; remove localStorage setup |

---

## Rejected alternatives

- **`staleTime` on reference data only** — eliminates repeat-navigation flashes, not first-load. Does not address XSS exposure. Deferred the architectural problem.
- **Non-HttpOnly user-info cookie alongside HttpOnly auth cookie** — partially undermines XSS improvement; more surface area.
- **`/api/auth/me` endpoint on mount** — extra network round-trip defeats SSR benefit.
- **Gradual per-page migration** — inconsistent pattern. Pages become a mix of Client + Server which is harder to maintain than a clean cut.

## Trade-offs accepted

- All RTL tests that use `localStorage.setItem('sc_token', ...)` need updating. The test suite will be temporarily broken during Phase 1 until the `UserProvider` mock is in place.
- Client Components that call `useAuth()` still require `UserProvider` to be present in the tree — the dashboard layout provides it. Pages outside the dashboard layout (public, auth routes) do not have `UserProvider` and cannot call `useAuth()`.
- Middleware JWT verification adds a small overhead on every dashboard request. Acceptable — it replaces a client-side `useEffect` check that was already running.

## Out of scope

- Token refresh / revocation (not in ADR-007, still not in scope).
- Multiple users per tenant (schema-supported, UI deferred).
- Migrating `(public)` or `(marketing)` routes — they are already Server Components.
- Rate limiting on `/api/public/*` — separate tracked item.

## Edge cases

- **Dev vs production `Secure` flag**: `Secure` attribute omitted when `NODE_ENV !== 'production'`. Cookie still HttpOnly in dev.
- **30-day expiry**: `Max-Age` = `JWT_EXPIRY` env var (same as current). Middleware redirects to `/login` when cookie is expired or invalid.
- **Simultaneous tab logout**: Middleware catches the expired/missing cookie on next navigation — no push mechanism needed.
- **`UnauthenticatedOnly` on `/login`**: Middleware doesn't redirect authenticated users away from `/login` (only guards dashboard). The existing client-side redirect in `UnauthenticatedOnly` is retained; `useAuth()` still works because middleware injects user headers for any authenticated request, but `UserProvider` is only in the dashboard layout. A simple middleware rule for `/login` + `/register` (redirect to `/services` if cookie present) replaces the client-side check cleanly.
