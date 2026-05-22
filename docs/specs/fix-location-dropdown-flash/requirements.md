# Requirements: fix-location-dropdown-flash

## User stories

- As a staff member creating a new appointment, I want the Location dropdown to be present immediately when the panel opens, so that the form does not shift or flash after a brief delay.

## Acceptance criteria

- [ ] Opening the New Appointment panel on a multi-location tenant shows the Location dropdown immediately — no 200–300 ms delay or pop-in.
- [ ] Single-location tenants continue to hide the Location picker (auto-selects the one location).
- [ ] No additional network request for locations is fired when the panel opens.
