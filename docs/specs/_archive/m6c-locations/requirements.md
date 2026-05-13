# Requirements: m6c-locations

## User stories

- As a business owner, I want to create named locations for my business so each branch has its own identity.
- As a business owner, I want to edit a location's name, address, and timezone so the information stays accurate.
- As a business owner, I want to deactivate a location that is no longer in use so it stops appearing in booking flows without losing historical data.
- As a business owner, I want to delete a location that has no staff and no bookings so I can clean up test entries.
- As a business owner, I want to assign a staff member to a location so the system knows where they work.
- As a business owner, I want to filter the staff list by location so I can manage each branch's team separately.
- As a business owner, when I enter a manual appointment I want to record which location it is at so the booking is properly scoped.
- As a business owner with only one location, I want location selection to be invisible so I have no extra friction.

## Acceptance criteria

### Locations list page (/locations)

- [ ] "Locations" navigation entry is present in the dashboard sidebar, linking to `/locations`.
- [ ] The page lists all active locations showing name, address (if set), and timezone.
- [ ] A "Show inactive" toggle reveals deactivated locations with a visual indicator distinguishing them from active ones.
- [ ] A "New location" button opens the create form.
- [ ] Clicking a location row navigates to `/locations/:locationId`.

### Create location

- [ ] Create form accepts: name (required), address (optional), timezone (required; IANA timezone string e.g. `Europe/Riga`).
- [ ] Submit calls `POST /tenants/:tenantId/locations`; on 201 navigates to the new location detail page.
- [ ] On 422: inline field errors are shown; form stays open.

### Location detail page (/locations/:locationId)

- [ ] Shows name, address, timezone in editable fields.
- [ ] Saving calls `PATCH /tenants/:tenantId/locations/:locationId`; on 200 shows a success toast.
- [ ] A "Deactivate" button (shown when `is_active = true`) shows an `AlertDialog`; on confirm calls PATCH with `{ isActive: false }` and navigates back to the list.
- [ ] A "Reactivate" button (shown when `is_active = false`) calls PATCH with `{ isActive: true }`; navigates back to the list on success.
- [ ] A "Danger zone" section contains a "Delete location" button.
- [ ] Clicking "Delete location" shows an `AlertDialog`; confirming calls `DELETE /tenants/:tenantId/locations/:locationId`.
- [ ] On 204: navigates to `/locations`.
- [ ] On 409 (location still has staff or bookings): shows a toast error; page stays open.

### Staff location assignment

- [ ] The staff create form includes a "Location" dropdown listing all active locations.
- [ ] For single-location tenants the dropdown is pre-selected with the sole location; for multi-location tenants no default is applied.
- [ ] Submitting the create form without a location selected returns 422; inline error is shown.
- [ ] The staff detail profile section includes a "Location" dropdown; saving calls `PATCH /tenants/:tenantId/staff/:staffId` with `locationId`.
- [ ] The staff list page shows a location filter dropdown above the list for multi-location tenants; the filter is hidden for single-location tenants.
- [ ] Selecting a location from the filter calls `GET /tenants/:tenantId/staff?locationId=:id` and re-renders the list.

### Appointment location

- [ ] `NewAppointmentPanel` includes a location selector.
- [ ] For single-location tenants the selector is hidden and the location is auto-applied from the sole active location.
- [ ] For multi-location tenants the selector is a required dropdown; submitting without a selection shows a validation error.
- [ ] The created booking carries `locationId` in the request body.
- [ ] Existing bookings created before M6c show "—" for location in `AppointmentDetailDialog`.
- [ ] The public endpoint (`POST /public/:tenantSlug/bookings`) auto-resolves the location when the tenant has exactly one active location; returns 422 with a clear error message when the tenant has multiple locations (until M7 adds the client-facing location step).

### Data model

- [ ] `locations` table: `id`, `tenant_id` NOT NULL, `name` NOT NULL, `address` nullable, `timezone` NOT NULL DEFAULT `'UTC'`, `is_active` NOT NULL DEFAULT `true`, `created_at`. RLS enabled.
- [ ] `staff.location_id` UUID NOT NULL FK → `locations(id)` ON DELETE RESTRICT.
- [ ] `bookings.location_id` UUID NOT NULL FK → `locations(id)` ON DELETE RESTRICT.
- [ ] Migration seeds one default location per existing tenant (name = tenant name, timezone = `'UTC'`) and backfills `staff.location_id` and `bookings.location_id` to that default location.
- [ ] RLS policy on `locations` uses the same `app.current_tenant_id` pattern as all other tenant-scoped tables.

### Quality

- [ ] `pnpm typecheck` passes with zero errors.
- [ ] API integration tests cover: create location, list active only, list with `includeInactive=true`, get by id, update, deactivate, reactivate, delete with no refs (204), delete with staff (409), delete with bookings (409).
- [ ] API integration tests cover: POST staff with `locationId`, PATCH staff to change `locationId`, GET staff list filtered by `locationId`.
- [ ] API integration tests cover: POST booking with valid `locationId` (201), POST booking without `locationId` (422), POST booking with `locationId` from another tenant (404).
- [ ] API integration tests cover: public POST booking on single-location tenant auto-assigns location (201), public POST booking on multi-location tenant returns 422.
- [ ] RTL + MSW tests cover: location list renders active/inactive, create form validation (name required, timezone required), deactivate AlertDialog, delete 409 shows toast, staff form location dropdown pre-selects for single-location, staff list location filter hidden for single-location tenant, `NewAppointmentPanel` hides location selector for single-location tenant.
- [ ] No console errors on any happy-path flow.
