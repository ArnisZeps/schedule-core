# Tasks: React Query SSR Hydration

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-23 Implementation

### Foundation

- [x] Write ADR-013: amends ADR-012 section 3, replacing `initialData`/prop-threading guidance with `dehydrate`/`HydrationBoundary` as the standard SSR hydration pattern.
- [x] Create `apps/web/src/lib/server/queryClient.ts` — `makeQueryClient()` factory function.

### Services page (simplest, establishes the pattern)

- [x] Write failing tests in `apps/web/src/test/dashboard-ssr-phase2.test.tsx`:
  - `ServiceListPage` renders `initialServices` data via `HydrationBoundary` (not `initialServices` prop).
  - Hang the MSW `/services` handler; assert data appears synchronously from dehydrated state.
- [x] Run tests — confirm red.
- [x] Update `services/page.tsx`: use `makeQueryClient()` + `setQueryData` + `dehydrate`; pass `dehydratedState` to `ServiceListPage`.
- [x] Update `ServiceListPage`: accept `dehydratedState` prop, wrap return in `HydrationBoundary`, remove `initialServices` prop.
- [x] Update `useServices`: remove `initialData` param; add `staleTime: 5 * 60_000` unconditionally.
- [x] Run tests — confirm green.

### Locations page

- [x] Write failing tests:
  - `LocationListPage` renders via `HydrationBoundary`.
- [x] Run tests — confirm red.
- [x] Update `locations/page.tsx`: `makeQueryClient()` + `setQueryData(['locations', tenantId, { includeInactive: false }], ...)` + `dehydrate`.
- [x] Update `LocationListPage`: accept `dehydratedState`, wrap in `HydrationBoundary`, remove `initialLocations`.
- [x] Update `useLocations`: remove `initialData` param; add `staleTime: 5 * 60_000` unconditionally.
- [x] Run tests — confirm green.

### Staff page

- [x] Write failing tests:
  - `StaffListPage` renders via `HydrationBoundary`.
- [x] Run tests — confirm red.
- [x] Update `staff/page.tsx`: `makeQueryClient()` + `setQueryData(['staff', tenantId, { includeInactive: false, locationId: undefined }], ...)` + `dehydrate`.
- [x] Update `StaffListPage`: accept `dehydratedState`, wrap in `HydrationBoundary`, remove `initialStaff`.
- [x] Update `useStaffList`: remove `initialData` param; add `staleTime: 5 * 60_000` unconditionally.
- [x] Run tests — confirm green.

### Appointments page — URL format + navigation regression

- [x] Write failing tests in `appointments.test.tsx`:
  - `renderAppointments` helper switches default search to `'view=week&from=2026-05-04&to=2026-05-11'`.
  - "Next" navigation asserts `from=2026-05-11&to=2026-05-18` in URL (not `date=`).
  - "Prev" navigation asserts `from=2026-04-27&to=2026-05-04` in URL.
  - "Today" navigation asserts no `from`/`to` in URL when on current week.
  - **Regression test**: MSW returns week A bookings for week A range, week B bookings for week B range. Render week A → navigate Next → assert week B bookings visible (not week A's `initialData`).
- [x] Run tests — confirm red.
- [x] Update `AppointmentsPage`:
  - Remove all `initial*` props and `useMemo` cache seeding.
  - Accept `dehydratedState?: unknown`; wrap return in `HydrationBoundary state={dehydratedState}`.
  - Read `from`/`to` URL params (not `date`). Compute ISO keys as `param + 'T00:00:00.000Z'`.
  - URL sync: write `from`/`to` params (YYYY-MM-DD) for week view; write `view=day&date=` for day view.
  - Default (no URL params): compute current UTC Monday for `from`, +7 days for `to`.
- [x] Run tests — confirm green.

### Appointments page — SSR hydration

- [x] Write failing tests in `dashboard-ssr-phase2.test.tsx`:
  - Replace `AppointmentsPage` test: use `dehydrate`/`HydrationBoundary` with bookings + services + staff + locations keys seeded.
  - `beforeEach` URL: `'view=week&from=2026-05-04&to=2026-05-11'`.
  - Assert WeekView headers present on synchronous first render (no `waitFor`).
- [x] Run tests — confirm red.
- [x] Update `appointments/page.tsx`:
  - Accept `searchParams` prop (`{ from?: string; to?: string }`).
  - Derive `from`/`to` ISO strings from params (or default to current UTC Monday week).
  - `makeQueryClient()` + `setQueryData` for: bookings, services, locations (includeInactive: true), staff, service-staff entries.
  - Pass `dehydrate(qc)` as `dehydratedState` to `AppointmentsPage`.
- [x] Update `useBookings`: remove `initialData` param; add `staleTime: 30_000` unconditionally.
- [x] Update `useBookingsPrefetch`: replace `startOfWeek`/`endOfWeek` with ISO arithmetic (`new Date(new Date(from).getTime() ± N * 86400000).toISOString()`). Remove `date-fns` week imports.
- [x] Run tests — confirm green.

### Cleanup + domain docs

- [x] Remove `console.log` calls from `useBookingsPrefetch`.
- [x] Verify no remaining `initial*` prop references anywhere in `src/` (grep check).
- [x] Update `docs/domains/bookings.md`: remove `initialBookings`/`initialServiceStaff` from Frontend section; document `dehydratedState` prop on `AppointmentsPage`; update URL format to `?from=&to=`.
- [x] Run full test suite — confirm all green.
