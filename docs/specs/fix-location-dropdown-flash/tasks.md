# Tasks: fix-location-dropdown-flash

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-22 Initial fix

- [x] Write failing tests: `NewAppointmentPanel` renders the Location dropdown immediately (no async wait) when given two active locations via the `locations` prop
- [x] Add `locations: Location[]` prop to `NewAppointmentPanel`; remove the internal `useLocations()` call and import; derive `activeLocations` and `showLocationPicker` from the prop
- [x] Pass `locations` from `AppointmentsPage` to `<NewAppointmentPanel>`
- [x] Update `docs/domains/bookings.md` — document the `locations` prop on `NewAppointmentPanel` and remove reference to its internal `useLocations` call
