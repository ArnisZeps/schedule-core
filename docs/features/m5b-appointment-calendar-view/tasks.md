# Tasks: m5b-appointment-calendar-view

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-02 Initial implementation

- [x] Write RTL tests for all flows (present for approval before implementing)
- [x] Add `date-fns` to `apps/web` dependencies
- [x] Implement `useBookings`, `useUpcomingBookings`, `useCancelBooking`, `useRescheduleBooking` hooks
- [x] Implement `CalendarToolbar` (prev/next/today, view toggle, resource Select)
- [x] Implement `TimeGutter`
- [x] Implement `computeColumnLayout` helper and `AppointmentBlock`
- [x] Implement `DayColumn`
- [x] Implement `WeekView`
- [x] Implement `DayView`
- [x] Implement `AppointmentDetailDialog` (details, cancel via AlertDialog, reschedule via datetime-local inputs)
- [x] Implement `ListView`
- [x] Implement `AppointmentsPage` (URL params, compose views)
- [x] Add `/appointments` route in `App.tsx`
- [x] Add "Calendar" link to `Sidebar.tsx`
- [x] Playwright browser verification (week view, day view, list view, cancel, reschedule)
