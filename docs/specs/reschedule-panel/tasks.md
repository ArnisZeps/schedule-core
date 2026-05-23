# Tasks: Reschedule Panel

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-23 Initial implementation

- [x] Extend `PATCH /bookings/:id` route to accept `override?: boolean`; skip `checkOverlap` and `checkStaffOverlap` when `true`
- [x] Extend `useRescheduleBooking` mutation input with `override?: boolean`
- [x] Update `AppointmentDetailDialog`: remove datetime reschedule form; add `onReschedule: (booking: Booking) => void` prop; replace reschedule section with single "Reschedule appointment" button
- [x] Update `AppointmentsPage`: add `rescheduleBooking` state; wire `onReschedule` handler (close dialog, set state, open panel); clear state on panel close
- [x] Extend `NewAppointmentPanel` with `mode` / `rescheduleBooking` props: prefill + lock client/service/location/staff fields, initialize date + slot from booking, change title and submit label, call `useRescheduleBooking` on submit
- [x] Add "Custom time" collapsible section to `NewAppointmentPanel`: time input, computed end time display, hide slot grid when active, send `override: true` on submit
- [x] Update `docs/domains/bookings.md`: PATCH contract (`override` flag), `useRescheduleBooking` interface, `NewAppointmentPanel` props, `AppointmentDetailDialog` props
