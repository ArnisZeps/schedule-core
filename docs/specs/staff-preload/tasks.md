# Tasks: staff-preload

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-20 Initial implementation

- [x] Write failing tests: SSR query helper groups `staff_services JOIN staff` rows into `ServiceStaffEntry[]` correctly (including empty-staff case and multi-location grouping)
- [x] Add the service-staff SQL query as a 5th parallel query inside `withTenantContext` in `appointments/page.tsx`; map flat rows to `ServiceStaffEntry[]`; pass as `initialServiceStaff` to `AppointmentsPage`
- [x] In `AppointmentsPage`, accept `initialServiceStaff` prop; on first render call `queryClient.setQueryData` for each entry using the exact query key format from `useServiceStaff`
- [x] Verify staff-create and staff-update mutations already invalidate the `useServiceStaff` query key; add invalidation if missing
- [x] Update `docs/domains/bookings.md` — document `initialServiceStaff` prop on `AppointmentsPage` and the 5th SSR query
