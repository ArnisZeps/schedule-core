# Requirements: m6b-staff

## User stories

- As a business owner, I want to add staff members with a name, optional email, and optional phone so I can track who works for me.
- As a business owner, I want to deactivate a staff member so they no longer appear in future booking flows without deleting their record or losing appointment history.
- As a business owner, I want to reactivate an inactive staff member so they can be assigned to bookings again.
- As a business owner, I want to assign one or more services to a staff member so the system knows which services they can perform.
- As a business owner, I want to drag on a weekday calendar to define a staff member's recurring weekly hours so I can set up split shifts visually.
- As a business owner, I want to drag on a date calendar to create an override block (available or not available) for a staff member so I can handle exceptions like holidays or one-off availability changes.
- As a business owner, I want overrides to span multiple days so I can mark a holiday week in one action.
- As a business owner, I want available overrides highlighted green and not-available overrides highlighted red on the calendar so I can see exceptions at a glance.

## Acceptance criteria

### Staff list page (/staff)

- [ ] A "Staff" navigation entry is present in the dashboard sidebar, linking to `/staff`.
- [ ] The page lists all active staff members showing name, email (if set), and phone (if set).
- [ ] A "Show inactive" toggle reveals deactivated staff with a visual indicator distinguishing them from active staff.
- [ ] A "New staff member" button opens a create form.
- [ ] Clicking a staff row navigates to `/staff/:staffId`.

### Create staff

- [ ] Create form accepts: name (required), email (optional; valid email format when non-empty), phone (optional).
- [ ] Submit calls `POST /tenants/:tenantId/staff`; on 201 navigates to the new staff detail page.
- [ ] On 422: inline field errors are shown; form stays open.

### Staff detail page (/staff/:staffId)

- [ ] Profile section shows name, email, phone in editable fields.
- [ ] Saving calls `PATCH /tenants/:tenantId/staff/:staffId`; on 200 shows a success toast.
- [ ] A "Deactivate" button (shown when `is_active` is true) soft-deletes the staff member and navigates back to the list on success.
- [ ] A "Reactivate" button (shown when `is_active` is false) sets `is_active = true` via PATCH; navigates back to the list on success.
- [ ] An `AlertDialog` confirmation is shown before deactivating.
- [ ] The detail page has three additional sections below the profile: Services, Weekly Schedule, Overrides.

### Services section

- [ ] All tenant services are listed as checkboxes.
- [ ] Checked services are those currently assigned to the staff member.
- [ ] A "Save" button calls `PUT /tenants/:tenantId/staff/:staffId/services` with the full array of checked service IDs.
- [ ] On success: a success toast is shown; checkboxes reflect the saved state.

### Weekly schedule section

- [ ] Displays a 7-column weekday calendar (Monday–Sunday). No dates — columns represent days of the week only.
- [ ] Each column shows existing schedule windows as coloured blocks with their time range.
- [ ] Dragging within a column creates a new time window block (times snapped to the nearest 15-minute boundary).
- [ ] A ghost block is shown during drag to indicate the pending window.
- [ ] Drag interaction is inactive when the pointer is over an existing window block.
- [ ] Clicking an existing block opens a popover with editable start/end time inputs and a delete button.
- [ ] `start_time < end_time` is enforced; invalid windows show an inline error in the popover.
- [ ] A "Save schedule" button commits all pending changes via `PUT /tenants/:tenantId/staff/:staffId/schedules`.
- [ ] Multiple windows per day are valid (split shifts).

### Overrides section

- [ ] Displays a calendar in week view or day view (toggle in section toolbar), matching the visual pattern of the appointments page calendar.
- [ ] Available overrides are rendered as green blocks; not-available overrides are rendered as red blocks.
- [ ] A "Create override" button opens the override panel with no pre-filled values.
- [ ] Dragging within a day column opens the override panel pre-filled with that column's date as both start and end date, and the dragged time range as start and end time.
- [ ] Drag interaction is within a single day column only.
- [ ] Drag interaction is inactive when the pointer is over an existing override block.
- [ ] Clicking an existing override block opens the override panel pre-filled for editing.

### Override panel

- [ ] Panel slides in from the right (same pattern as `NewAppointmentPanel`).
- [ ] Fields: start date (required), end date (required, must be >= start date), type toggle (Available / Not Available), start time (required), end time (required).
- [ ] `start_time < end_time` enforced on submit.
- [ ] `start_date <= end_date` enforced on submit.
- [ ] Create submit calls `POST /tenants/:tenantId/staff/:staffId/overrides`; on 201 panel closes and calendar refreshes.
- [ ] Edit submit calls `PATCH /tenants/:tenantId/staff/:staffId/overrides/:overrideId`; on 200 panel closes and calendar refreshes.
- [ ] Panel includes a delete button (edit mode only) with an `AlertDialog` confirmation; on 204 panel closes and calendar refreshes.
- [ ] On 422: inline field errors are shown; panel stays open.

### Data model

- [ ] `staff` table: `id`, `tenant_id`, `name` (NOT NULL), `email` (nullable), `phone` (nullable), `is_active` (NOT NULL DEFAULT true), `created_at`.
- [ ] `staff_services` junction: `(staff_id, service_id)` PK, `tenant_id` denormalised for RLS.
- [ ] `staff_schedules`: `id`, `staff_id`, `tenant_id` (denormalised), `day_of_week` (0–6), `start_time` NOT NULL, `end_time` NOT NULL, `created_at`. Multiple rows per staff per day are valid.
- [ ] `staff_schedule_overrides`: `id`, `staff_id`, `tenant_id` (denormalised), `start_date` DATE NOT NULL, `end_date` DATE NOT NULL, `type` TEXT NOT NULL CHECK IN ('available', 'not_available'), `start_time` TIME NOT NULL, `end_time` TIME NOT NULL, `created_at`.
- [ ] RLS is enabled on all four tables using the same `app.current_tenant_id` pattern as existing tables.
- [ ] Deactivation sets `is_active = false`; no row is ever deleted via the deactivate action.

### Quality

- [ ] `pnpm typecheck` passes with zero errors.
- [ ] API integration tests cover: create staff, list (active only by default), list with `includeInactive=true`, get staff by id, update profile, deactivate (`is_active` → false), reactivate (`is_active` → true).
- [ ] API integration tests cover: PUT services replaces full set, GET returns assigned services, empty array removes all assignments.
- [ ] API integration tests cover: PUT schedules replaces full set, GET returns all windows, PUT with empty array removes all windows.
- [ ] API integration tests cover: create override (available), create override (not_available), update override (change type and dates), delete override, start_time >= end_time returns 422, start_date > end_date returns 422.
- [ ] RTL + MSW tests cover: staff list renders active/inactive, create form validation, service checkbox save, weekday calendar drag creates a block, block popover edit/delete, override calendar drag opens panel pre-filled, override panel create/edit/delete flow.
- [ ] No console errors on any happy-path flow.
