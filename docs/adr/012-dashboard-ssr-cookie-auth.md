# ADR-012 — Dashboard SSR + Cookie-Based Auth

**Date:** 2026-05-19
**Status:** Proposed
**Supersedes (partially):** ADR-007 (transport section only — JWT algorithm, payload, and bcrypt are unchanged)
**Amends:** ADR-010 (dashboard route group rendering strategy)

---

## Context

ADR-007 chose `Authorization: Bearer` header with JWT in `localStorage`. ADR-010 explicitly kept the
`(dashboard)` route group as Client Components, citing ADR-007 as unchanged and deferring
middleware-based auth to a future ADR.

Two problems have since become concrete:

1. **Empty loading states.** Reference data (staff, services, locations) loads client-side after
   hydration. Every page navigation shows an empty dropdown or skeleton for ~100–300 ms. As the
   dashboard grows, this compounds.

2. **XSS token exposure.** `localStorage` JWT is readable by any JavaScript on the page. The auth
   domain doc flags this as an accepted MVP risk, explicitly marking cookie-based auth as a
   post-MVP hardening task. The codebase is still small — now is the right time.

ADR-010's "defer SSR" rationale was correct for MVP: no concrete benefit at that scale. The
benefit is now concrete (loading states, security), and the cost of migrating later grows with
every new page and hook added.

---

## Decision

### 1. Auth transport: localStorage + Bearer header → HttpOnly cookie

`POST /api/auth/login` and `POST /api/auth/signup` set a `Set-Cookie` response header:

```
Set-Cookie: sc_token=<jwt>; HttpOnly; SameSite=Strict; Path=/; Max-Age=<JWT_EXPIRY_SECONDS>; Secure
```

The response body no longer returns `{ token }`. The client does not handle the token directly.

`withAuth.ts` reads from `request.cookies.get('sc_token')` instead of the `Authorization` header.
`apiFetch` drops the `Authorization` header injection entirely — cookies are sent automatically by
the browser for same-origin requests.

A `POST /api/auth/logout` route is added. It clears the cookie by setting `Max-Age=0`.

`JWT_SECRET`, payload structure (`sub`, `tenantId`, `iat`, `exp`), 30-day expiry, and HS256
algorithm are **unchanged** from ADR-007.

### 2. Next.js middleware for dashboard auth guard

`apps/web/middleware.ts` validates `sc_token` on every request to `/(dashboard)` routes.
Unauthenticated requests are redirected to `/login`. This replaces the client-side
`useEffect` hydration guard in `layout.tsx`.

### 3. Dashboard pages: Server Components with client islands

The `(dashboard)` route group pages become **async Server Components**. Each page:

1. Reads the decoded user (`userId`, `tenantId`) from the request (injected by middleware via
   `x-user-id` / `x-tenant-id` headers, or read directly via `cookies()`).
2. Fetches its data directly via `@/lib/server/db` + `withTenantContext` — no HTTP round-trip.
3. Passes fetched data as props to Client Component islands.

Interactive components (calendars, forms, mutation hooks) remain Client Components. They receive
initial data as props and may use React Query's `initialData` option for client-side re-fetching
after mutations.

### 4. User context for client-side hooks

Dashboard `layout.tsx` becomes a Server Component. It decodes the JWT from the cookie and renders
a `<UserProvider user={{ userId, tenantId }}>` Client Component that supplies the auth context.
`useAuth()` continues to work identically in all Client Components.

---

## Rejected alternatives

**Non-HttpOnly "user info" cookie alongside HttpOnly auth cookie** — avoids layout complexity but
puts user data (tenantId) in a JS-readable cookie, undermining the XSS improvement partially.

**`/api/auth/me` endpoint called on mount** — adds a network round-trip before the dashboard
renders. Defeats the SSR benefit.

**Keep Client Component pages, add `staleTime` to queries** — eliminates repeat-navigation
flashes but not the first-load flash. Does not address the XSS exposure.

**Gradual migration (keep some pages as Client Components)** — inconsistent pattern, harder to
maintain. SSR and CSR data fetching cannot easily share the same page-level query unless
`initialData` is threaded through.

---

## Consequences

- `AuthContext.tsx` loses `login(token)`, `logout()` as localStorage ops. These become server
  interactions (cookie set by API, cookie cleared by logout route).
- `apiFetch` simplified: no `localStorage` read, no `Authorization` header injection.
- Test suite needs updating: tests currently call `localStorage.setItem('sc_token', ...)` to
  mock auth. Tests for Client Component islands can mock the `UserProvider` context directly.
  Route Handler tests (API integration tests) send cookies instead of Authorization headers.
- Vercel deployment: `Secure` cookie attribute requires HTTPS. Dev runs on HTTP localhost —
  `Secure` must be omitted in development (controlled by `NODE_ENV`).
- ADR-007's "No cookies" transport constraint is superseded. All other ADR-007 decisions stand.
- ADR-010's "`(dashboard)` — Client Components" constraint is superseded. All other ADR-010
  decisions stand (marketing + public routes unchanged).
