# Tasks: m6-manual-appointment-entry

<!-- Never delete tasks. Mark done, append new ones. -->

> **Note:** File paths in tasks below reflect the pre-migration (Express + Vite SPA) architecture. API files are now under `apps/web/app/api/`, page components under `src/page-components/`. See `docs/features/next-js-migration/` and `docs/features/api-nextjs-migration/`.

## 2026-05-04 Initial implementation

### Schema and data model
- [x] Write `packages/db/migrations/0004_m6_phone_notes_duration.sql`: add `services.duration_minutes`, add `bookings.client_phone`, add `bookings.notes`, make `bookings.client_email` nullable
- [x] Update `docs/db/data-model.md`: document new columns on `services` and `bookings`

### API — backend
- [x] Add `generateAllSlots` to `apps/api/src/lib/availability.ts`: same logic as `generateSlots` but returns all slots with `available: boolean` flag
- [x] Update `apps/api/src/routes/services.ts`: add `duration_minutes` to `ServiceRow`, `format`, all SQL queries, `createSchema`, `patchSchema`; add `GET /:id/slots` handler
- [x] Update `apps/api/src/routes/bookings.ts`: add `clientPhone` (required, min 7), `clientEmail` (optional email), `notes` (optional), `override` (optional boolean) to POST schema; add `notes` to PATCH schema; extend `BookingRow`, `SELECT_COLS`, and `format` with `client_phone` and `notes`
- [x] Update `apps/api/src/routes/public.ts`: extend `BookingRow`, `SELECT_COLS`, `format` for `client_phone` and `notes`; `client_email` stays required in the public booking schema
- [x] Write API integration tests for updated POST bookings: phone only, phone + email, with notes, missing phone → 422, overlap without override → 409, `override: true` bypasses overlap, `override: true` bypasses availability
- [x] Write API integration tests for `GET /services/:id/slots`: returns all slots with `available` flag, taken slots correctly identified, empty array when no availability rules
- [x] Update `docs/features/m4b-bookings-api/design.md`: update POST request contract and response shape for phone, notes, override

### Frontend — types and hooks
- [x] Update `Booking` interface in `apps/web/src/hooks/useBookings.ts`: add `clientPhone: string`, `notes: string | null`; change `clientEmail` to `string | null`
- [x] Add `apps/web/src/hooks/useCreateBooking.ts`
- [x] Add `apps/web/src/hooks/useServiceSlots.ts`

### Frontend — components
- [x] Update `apps/web/src/components/calendar/AppointmentDetailDialog.tsx`: show `clientPhone` (always), `clientEmail` only when non-null, `notes` when non-null
- [x] Add drag-selection to `apps/web/src/components/calendar/DayColumn.tsx`: mousedown/mousemove/mouseup handlers, ghost block, `onTimeSelect` prop; ensure AppointmentBlock calls `stopPropagation` on mousedown
- [x] Add "New appointment" Button to `apps/web/src/components/calendar/CalendarToolbar.tsx`
- [x] Build `apps/web/src/components/calendar/NewAppointmentPanel.tsx`: client section, service chips + dropdown, date row + slot grid, override checkbox, conflict warning banner, notes textarea, footer summary, "Book appointment" submit
- [x] Wire panel into `apps/web/src/pages/appointments/AppointmentsPage.tsx`: panel open state, `onTimeSelect` handler from DayColumn, toolbar button handler, backdrop dismiss

### Tests
- [x] Write RTL + MSW tests: panel opens via toolbar button, panel opens via DayColumn drag, slot grid renders available and taken states, conflict warning appears when taken slot selected, form submit triggers invalidation
- [x] Playwright verification: open panel via button, click-to-prefill time, complete form and submit, verify booking appears in calendar, conflict warning + override flow

## 2026-05-10 M6d — Staff selection

### Schema
- [x] Write `packages/db/migrations/0007_m6d_booking_staff.sql`: add `staff_id` nullable UUID FK → `staff(id)` ON DELETE RESTRICT on `bookings`; add index on `bookings(staff_id)`; `DROP TABLE availability_rules`
- [x] Update `docs/db/data-model.md`: add `staff_id` column to `bookings` table; remove `availability_rules` table

### Availability rules removal (must complete before migration runs)
- [x] Remove `availability_rules` CRUD API routes and all supporting code (route handlers, Zod schemas, SQL helpers) introduced in M4/M5a
- [x] Remove availability rules configuration UI from the dashboard (page components, form components, hooks, nav entries introduced in M5a)
- [x] Verify no remaining imports or references to `availability_rules` in the codebase (`pnpm typecheck` passes, no runtime references)

### API — Staff-for-service endpoint
- [x] Write integration tests: GET returns active staff at location assigned to service; inactive staff excluded; unassigned staff excluded; staff at different location excluded; empty array when no matches
- [x] Implement `GET /tenants/:tenantId/services/:serviceId/staff?locationId=UUID`

### API — Slot generation cutover
- [x] Add `generateStaffSlots(client, staffId, date, durationMinutes)` to `apps/web/src/lib/server/availability.ts`: uses `staff_schedules` + `staff_schedule_overrides` and the staff member's existing non-cancelled bookings
- [x] Add `generateAnyAvailableSlots(client, tenantId, serviceId, locationId, date, durationMinutes)`: union of free slots across all active qualified staff at the location
- [x] Remove `generateSlots` and `generateAllSlots`; update all callers (owner slots route, public slots route)
- [x] Update `apps/web/app/api/tenants/[tenantId]/services/[serviceId]/slots/route.ts`: accept optional `staffId` and `locationId`; `locationId` required when `staffId` absent (400 otherwise); route to correct helper
- [x] Update public slots endpoint to use `generateAnyAvailableSlots`; resolve location as the tenant's single active location; 422 for multi-location tenants (unchanged)
- [x] Write integration tests for GET slots: `staffId` provided → staff-schedule-based slots, no `staffId` → any-available union, empty when staff has no schedule for the day, missing `locationId` without `staffId` → 400

### API — Bookings staff assignment
- [x] Update `apps/web/app/api/tenants/[tenantId]/bookings/route.ts`: add `staffId` (optional UUID or null) to POST Zod schema; implement explicit-staff path (active + assigned to service + no conflict check); implement auto-assign path (first free qualified active staff at `locationId`, ordered by `created_at`); skip staff checks when `override: true`; add `staff_id` to `BookingRow` and `SELECT_COLS`; join `staff.name` as `staff_name` in all SELECT queries; update `format` to include `staffId` and `staffName`
- [x] Write integration tests: explicit `staffId` (201 + staffId in response), null `staffId` auto-assigns (201 + staffId populated), `staffId` not in `staff_services` → 422, inactive `staffId` → 422, all qualified staff booked → 409, `override: true` with explicit `staffId` bypasses conflict (201), `override: true` with null `staffId` assigns first regardless of conflicts (201)
- [x] Update `docs/features/m4b-bookings-api/design.md`: document `staffId` and `staffName` in POST contract and response shape

### Frontend — Hooks
- [x] Add `useServiceStaff(serviceId: string | null, locationId: string | null)` to `apps/web/src/hooks/useStaff.ts`
- [x] Update `useServiceSlots` in `apps/web/src/hooks/useServiceSlots.ts`: add `staffId: string | null` and `locationId: string | null` params; include in query URL; disable query when neither is set
- [x] Update `Booking` interface in `apps/web/src/hooks/useBookings.ts`: add `staffId: string | null` and `staffName: string | null`
- [x] Update `CreateBookingInput` in `apps/web/src/hooks/useCreateBooking.ts`: add `staffId?: string | null`

### Frontend — Components
- [x] Update `apps/web/src/components/calendar/NewAppointmentPanel.tsx`: add staff dropdown after service field; populate via `useServiceStaff(selectedServiceId, selectedLocationId)`; "Any available" as first and default option; show inline note when `staffList.length === 0`; reset selected slot when staff changes; reset staff selection when location changes; pass `staffId` (null for "Any available") and `locationId` to `useServiceSlots` and submit payload
- [x] Update `apps/web/src/components/calendar/AppointmentDetailDialog.tsx`: show staff name row when `staffName` is non-null

### Tests
- [x] Write RTL + MSW tests: staff dropdown appears after service selection; "Any available" is first and default; selecting specific staff triggers slot grid refetch; no-staff-at-location inline note shown; location change resets staff selection; `staffId` included in POST body; null `staffId` when "Any available"
- [ ] Playwright: select specific staff member and complete booking; select "Any available" and complete booking; verify staff name appears in appointment detail dialog for specific-staff booking
