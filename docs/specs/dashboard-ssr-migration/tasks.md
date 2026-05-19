# Tasks: Dashboard SSR Migration

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-19 Phase 1 — Cookie-based auth

- [x] Update `POST /api/auth/login` to set `sc_token` HttpOnly cookie; remove `{ token }` from response body
- [x] Update `POST /api/auth/signup` to set `sc_token` HttpOnly cookie; remove `{ token }` from response body
- [x] Add `POST /api/auth/logout` route that clears the `sc_token` cookie (`Max-Age=0`)
- [x] Update `withAuth.ts` to read from `request.cookies.get('sc_token')` instead of `Authorization` header
- [x] Simplify `apiFetch` — remove `localStorage` read and `Authorization` header injection
- [x] Create `apps/web/middleware.ts` — guards `/(dashboard)` routes; verifies cookie; injects `x-user-id` + `x-tenant-id` headers; also redirects authenticated users away from `/login` and `/register`
- [x] Create `apps/web/src/components/UserProvider.tsx` — Client Component; accepts `user: { userId, tenantId }` prop; sets `AuthContext`
- [x] Update `apps/web/src/context/AuthContext.tsx` — remove localStorage read/write; `login()` and `logout()` become no-ops or are removed
- [x] Update dashboard `layout.tsx` — remove `'use client'`; read `x-user-id`/`x-tenant-id` from `headers()`; render `<UserProvider>`; remove hydration guard
- [x] Update `LoginPage` — remove `login(token)` call; redirect to `/services` on success
- [x] Update `RegisterPage` — remove `login(token)` call; redirect to `/services` on success
- [x] Update test helpers — replace `localStorage.setItem('sc_token', ...)` with `UserProvider` mock wrapper; update MSW handlers for cookie-based auth
- [x] Run full test suite — all tests green before proceeding to Phase 2

## 2026-05-19 Phase 2 — Server Component pages

- [x] Convert `/services` page to async Server Component; pass `initialServices` to `ServicesPage`; update `useServices` hook to accept `initialData`
- [x] Convert `/locations` page to async Server Component; pass `initialLocations` to `LocationListPage`; update `useLocations` hook to accept `initialData`
- [x] Convert `/staff` page to async Server Component; pass `initialStaff` to `StaffPage`; update `useStaffList` hook to accept `initialData`
- [x] Convert `/appointments` page to async Server Component; pass `initialBookings`, `initialServices`, `initialStaff`, `initialLocations` to `AppointmentsPage`; update affected hooks to accept `initialData`
- [x] Verify no empty loading states in browser (Playwright) for all four pages on first load
- [x] Update `docs/domains/auth.md` to reflect cookie transport, new logout route, UserProvider, and middleware auth guard
- [x] Update `docs/domains/bookings.md`, `services.md`, `locations.md`, `staff.md` to reflect Server Component data-fetching pattern
