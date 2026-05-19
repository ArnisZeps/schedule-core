# Tasks: Calendar Appointment Improvements

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-19 Initial implementation

- [x] Add `useConfirmBooking()` mutation to `apps/web/src/hooks/useBookings.ts`
- [x] Add Confirm button to `AppointmentDetailDialog` (visible for `pending` status only); wire to `useConfirmBooking()`
- [x] Update `AppointmentBlock` to apply muted/reduced-opacity style when `endAt < now && status !== 'cancelled'`
- [x] Add `staffId` URL param read/write to `AppointmentsPage`; apply client-side staff filter on bookings before passing to views
- [x] Add staff filter dropdown to `CalendarToolbar`; populate from `useStaff()`; wire `staffId`/`onStaffChange` props
- [ ] Update `docs/domains/bookings.md` to reflect `useConfirmBooking()`, updated component responsibilities, and `staffId` URL param
