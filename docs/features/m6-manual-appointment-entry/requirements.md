# Requirements: m6-manual-appointment-entry

## User stories

- As a business owner, I want a "New appointment" button in the calendar toolbar so that I can open the booking form without leaving the schedule view.
- As a business owner, I want to click-and-drag on the time grid to pre-fill the date and time in the form so that I can create appointments faster.
- As a business owner, I want to enter a client's name and phone number so that I can identify them without requiring an email address.
- As a business owner, I want to optionally enter the client's email so that I can record it if they provide it.
- As a business owner, I want quick-access service chips so that I can select a service in one tap.
- As a business owner, I want to see all time slots for the selected service and date — available and taken — so that I can choose a free slot or decide to override a conflict.
- As a business owner, I want to tick "Override availability" and book a conflicting or out-of-hours slot so that I have full control over my own schedule.
- As a business owner, I want to see a conflict warning that names the overlapping appointment when I pick a taken slot so that I know exactly what I am overriding.
- As a business owner, I want to add internal notes to the appointment so that I can capture client preferences visible only to staff.
- As a business owner, I want the completed appointment to appear immediately in the calendar so that I can confirm it was saved.

## Acceptance criteria

### Entry points
- [ ] "New appointment" button is visible in CalendarToolbar; clicking it opens the slide-over panel with today's date and no time pre-filled.
- [ ] Clicking on a DayColumn (without dragging) opens the panel with that column's date and the clicked time pre-filled as the start slot.
- [ ] Clicking-and-dragging on a DayColumn opens the panel with that column's date, the drag start time as start slot, and the drag end time used to auto-select the nearest slot.
- [ ] Drag interaction is inactive when the pointer is over an existing appointment block (block click behavior is preserved).

### Slide-over panel
- [ ] Panel slides in from the right at 480 px over the calendar; a semi-transparent backdrop covers the rest of the page.
- [ ] Clicking the backdrop or the X button dismisses the panel without saving.
- [ ] Panel scrolls internally; the footer (booking summary + actions) is always visible.

### Client section
- [ ] Client Name: required text input.
- [ ] Phone: required text input; minimum 7 characters enforced on submit.
- [ ] Email: optional text input; when non-empty, must be a valid email format.

### Service section
- [ ] Service dropdown lists all tenant services (name + duration in minutes).
- [ ] Up to 4 quick-access badge chips allow one-click service selection.
- [ ] Selecting a service refreshes the slot grid for the currently selected date.

### When section
- [ ] Date row shows the selected date with a "Change" button that opens a native date input.
- [ ] Slot grid fetches all time slots from `GET /tenants/:tenantId/services/:serviceId/slots?date=YYYY-MM-DD`.
- [ ] Available slots are shown as selectable; taken slots are shown as disabled.
- [ ] "Override availability" checkbox: when checked, taken slots become selectable.
- [ ] Selecting a slot sets `startAt`; `endAt` is auto-calculated as `startAt + service.duration_minutes`.
- [ ] When the selected slot overlaps an existing non-cancelled booking, a warning banner appears indicating the slot is already booked.

### Submission
- [ ] "Book appointment" button is disabled until name, phone, service, and a slot are all selected.
- [ ] Submit calls `POST /tenants/:tenantId/bookings` with `serviceId`, `clientName`, `clientPhone`, optional `clientEmail`, `startAt`, `endAt`, optional `notes`, and `override: true` when the override checkbox is checked.
- [ ] On 201: panel closes, bookings query invalidated, sonner toast confirms booking.
- [ ] On 409: inline error shown in panel; panel stays open.
- [ ] On 422: inline field errors shown; panel stays open.

### Detail dialog (updated from M5b)
- [ ] AppointmentDetailDialog shows `clientPhone` (always).
- [ ] AppointmentDetailDialog shows `clientEmail` only when non-null.
- [ ] AppointmentDetailDialog shows `notes` when non-null.

### Data model
- [ ] `bookings` has `client_phone TEXT NOT NULL`.
- [ ] `bookings.client_email` is nullable.
- [ ] `bookings` has `notes TEXT` (nullable).
- [ ] `services` has `duration_minutes INTEGER NOT NULL DEFAULT 30`.

### Quality
- [ ] `pnpm typecheck` passes with zero errors.
- [ ] API integration tests cover: create with phone only, create with phone + email, create with notes, missing phone returns 422, overlap without override returns 409, override bypasses overlap check, override bypasses availability check.
- [ ] API integration tests cover GET slots: available slots returned, taken slots marked correctly, empty array when no availability rules for the day.
- [ ] RTL + MSW tests cover: panel opens via button, panel opens via drag, slot grid renders available and taken states, conflict warning appears, form submits and bookings query is invalidated.
- [ ] Playwright covers: open panel via button, click-to-prefill time, submit success, conflict warning with override flow.
- [ ] No console errors on any happy-path flow.
