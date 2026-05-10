# Tasks: m6c-locations

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-10 Initial implementation

### Migration
- [x] Write `packages/db/migrations/0006_m6c_locations.sql` (locations table, seed default per tenant, backfill staff + bookings)
- [ ] Apply migration locally and verify: locations table exists with RLS, staff.location_id NOT NULL, bookings.location_id NOT NULL, default location seeded for each tenant

### API — Locations CRUD
- [x] Write integration tests: create location, list active only, list with includeInactive, get by id, update, deactivate, reactivate, delete with no refs (204), delete with staff (409), delete with bookings (409)
- [x] Implement `GET /tenants/:tenantId/locations`
- [x] Implement `POST /tenants/:tenantId/locations`
- [x] Implement `GET /tenants/:tenantId/locations/:locationId`
- [x] Implement `PATCH /tenants/:tenantId/locations/:locationId`
- [x] Implement `DELETE /tenants/:tenantId/locations/:locationId` (catch FK RESTRICT → 409)

### API — Staff changes
- [x] Write integration tests: POST staff with locationId, PATCH staff to change locationId, GET staff filtered by locationId
- [x] Add `locationId` to staff POST body and response shape
- [x] Add `locationId` to staff PATCH body and response shape
- [x] Add `?locationId` filter to staff GET list

### API — Bookings changes
- [x] Write integration tests: POST booking with locationId (201), POST booking without locationId (422), POST booking with locationId from another tenant (404), public POST on single-location tenant auto-assigns (201), public POST on multi-location tenant (422)
- [x] Add `locationId` (required) to owner POST booking body and response
- [x] Add `locationId` to bookings response shape (GET list, GET by id)
- [x] Update public POST booking to auto-resolve location (single-location → assign; multi-location → 422)

### Owner UI — Locations
- [x] Write RTL + MSW tests: list renders active/inactive, show-inactive toggle, create form validation (name required, timezone required), deactivate AlertDialog, delete 409 shows toast error, reactivate
- [x] Add "Locations" nav entry to Sidebar
- [x] Implement `useLocations`, `useLocation`, `useCreateLocation`, `useUpdateLocation`, `useDeleteLocation` hooks
- [x] Implement `LocationForm` (name, address, timezone fields)
- [x] Add `/locations`, `/locations/new`, `/locations/:locationId` routes
- [x] Implement `LocationListPage` (list, show-inactive toggle, new location button)
- [x] Implement `LocationDetailPage` (profile edit, deactivate/reactivate, danger zone delete)

### Owner UI — Staff location assignment
- [x] Write RTL + MSW tests: staff form shows location dropdown, single-location pre-selects and hides dropdown, multi-location requires selection, staff list shows location filter for multi-location tenant, filter is hidden for single-location tenant
- [x] Add location dropdown to `StaffForm`; derive single-location auto-select from `useLocations()`
- [x] Show location in `StaffDetailPage` profile section
- [x] Add location filter dropdown to `StaffListPage` (hidden when `locations.length <= 1`)
- [x] Update `useCreateStaff` and `useUpdateStaff` inputs to include `locationId`
- [x] Update `Staff` type in `useStaff.ts` to include `locationId`

### Owner UI — Appointment location
- [x] Write RTL + MSW tests: NewAppointmentPanel hides location selector for single-location tenant, shows required dropdown for multi-location, submit without location fails validation
- [x] Add location selector to `NewAppointmentPanel`; hide when `locations.length === 1`
- [x] Update `CreateBookingInput` to include `locationId`
- [x] Update `Booking` type in `useBookings.ts` to include `locationId`
- [x] Update `AppointmentDetailDialog` to show location name (or "—" when null/not found)

### Docs
- [x] Update `docs/db/data-model.md`: add `locations` table, `staff.location_id`, `bookings.location_id`, updated RLS list
