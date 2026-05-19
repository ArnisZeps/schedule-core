# Requirements: Calendar Appointment Improvements

## User stories

- As a business owner, I want to confirm a pending appointment, so that I can signal the booking is accepted and distinguish it visually from unreviewed ones.
- As a business owner, I want past appointments that were never acted on to look different from upcoming ones, so that I can focus on what still needs attention.
- As a business owner, I want to filter the calendar by staff member, so that I can view one person's schedule in isolation.

## Acceptance criteria

### Appointment approval
- [ ] Pending appointments show a "Confirm" button in the detail dialog.
- [ ] Clicking Confirm sets the booking status to `confirmed` via `PATCH { status: 'confirmed' }`.
- [ ] The Confirm button is not shown for `confirmed` or `cancelled` appointments.
- [ ] On success the calendar block updates to the confirmed color without a full page reload.

### Past appointment visual state
- [ ] A calendar block where `endAt` is in the past and status is `pending` or `confirmed` renders with reduced opacity and a muted color palette.
- [ ] Cancelled blocks are unaffected (already visually distinct).
- [ ] The "past" treatment is applied in week view, day view, and list view.

### Staff filter
- [ ] A staff dropdown appears in the calendar toolbar alongside the existing service filter.
- [ ] Selecting a staff member filters calendar blocks to show only appointments for that person.
- [ ] An "All staff" option (default) removes the filter and shows everyone.
- [ ] The selected staff filter is stored in the URL as a `staffId` param so the view is bookmarkable.
- [ ] The staff filter works in week view, day view, and list view.
- [ ] The dropdown is populated from the tenant's active staff list.
