# Tasks: m6-manual-appointment-entry

<!-- Never delete tasks. Mark done, append new ones. -->

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
