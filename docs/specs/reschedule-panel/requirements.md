# Requirements: Reschedule Panel

## User stories

- As a business owner, I want to reschedule a booking using the same appointment panel I use to create bookings, so that I can see available slots rather than entering raw datetime values.
- As a business owner, I want the reschedule panel to be prefilled with the existing client and appointment details, so that I only need to pick a new time.
- As a business owner, I want to enter a custom time outside working hours when creating or rescheduling an appointment, so that I can accommodate special cases without being constrained by the configured schedule.

## Acceptance criteria

### Reschedule opens the panel

- [ ] Clicking "Reschedule" in the appointment detail dialog closes the dialog and opens `NewAppointmentPanel` in reschedule mode.
- [ ] The panel title reads "Reschedule appointment".
- [ ] Client name, phone, and email fields are pre-filled and read-only.
- [ ] Service is pre-selected and locked (non-interactive).
- [ ] Location is pre-selected and locked (non-interactive).
- [ ] Staff is pre-selected and locked (non-interactive).
- [ ] The date defaults to the booking's existing date; the slot grid shows that date's availability.
- [ ] The original time slot is pre-selected in the slot grid if it appears as available; otherwise no slot is pre-selected.
- [ ] The existing raw datetime reschedule form (datetime-local inputs + Reschedule button) inside `AppointmentDetailDialog` is removed.

### Reschedule submission

- [ ] Clicking "Reschedule appointment" calls `PATCH /api/tenants/:tenantId/bookings/:id` with `{ startAt, endAt }`.
- [ ] On success the panel closes and the calendar refreshes.
- [ ] A 409 conflict response is shown as an inline error in the panel; the panel stays open.

### Custom time section

- [ ] Both new-appointment and reschedule panel modes show a "Custom time" section below the slot grid.
- [ ] The section is collapsed by default; a toggle expands it.
- [ ] When expanded: a time input (HH:MM) appears for the start time; a read-only computed end time is shown (start + service `durationMinutes`).
- [ ] When custom time is active the slot grid is hidden.
- [ ] When custom time is active `override: true` is sent with the POST (new) or PATCH (reschedule) body.
- [ ] Toggling custom time off restores the slot grid and clears the custom time input.
- [ ] The submit button is disabled until a valid time is entered while custom time is active.
