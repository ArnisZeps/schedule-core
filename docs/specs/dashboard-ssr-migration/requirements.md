# Requirements: Dashboard SSR Migration

## User stories

- As a business owner, I want the dashboard to show my data immediately on page load, so that I never see empty dropdowns or skeleton screens while navigating.
- As a business owner, I want my session to be protected against XSS token theft, so that a compromised script cannot steal my credentials.
- As a developer, I want dashboard pages to be Server Components that fetch data at render time, so that adding new pages follows a consistent, simpler pattern.

## Acceptance criteria

### Cookie-based auth
- [ ] `POST /api/auth/login` sets a `sc_token` HttpOnly cookie; no longer returns `{ token }` in response body.
- [ ] `POST /api/auth/signup` sets the same `sc_token` HttpOnly cookie.
- [ ] `POST /api/auth/logout` clears the `sc_token` cookie (`Max-Age=0`); client redirects to `/login`.
- [ ] All owner-facing API Route Handlers read auth from the `sc_token` cookie (via `withAuth.ts`); the `Authorization: Bearer` header is no longer required or checked.
- [ ] `apiFetch` does not inject an `Authorization` header; cookies are sent automatically by the browser.

### Middleware auth guard
- [ ] `apps/web/middleware.ts` intercepts requests to `/(dashboard)` routes and redirects unauthenticated users to `/login` without loading the page.
- [ ] The existing client-side `useEffect` hydration guard in `layout.tsx` is removed.
- [ ] Authenticated users visiting `/login` or `/register` are still redirected to `/services`.

### Server Component pages
- [ ] All four dashboard pages (`/appointments`, `/services`, `/locations`, `/staff`) are async Server Components that fetch their initial data server-side.
- [ ] No loading skeleton or empty dropdown is visible on first render for reference data (services, staff, locations).
- [ ] Interactive components (calendar, forms, mutation buttons) remain Client Components and behave identically to before.
- [ ] `useAuth()` continues to return `{ userId, tenantId }` in all Client Components without any change to call sites.

### Tests
- [ ] All existing RTL tests pass after the migration (auth setup updated — no more `localStorage.setItem`).
- [ ] API integration tests updated to send `Cookie: sc_token=...` instead of `Authorization: Bearer`.
