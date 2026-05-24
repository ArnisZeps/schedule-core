# Tasks: Booking Calendar Mobile Skeleton

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-24 Initial implementation

- [x] Add `CalendarSkeleton` component inside `BookingCalendar.tsx` matching the structural skeleton described in `design.md`
- [x] Replace the `availableDates === null` overlay block in `BookingCalendar` with a conditional render of `<CalendarSkeleton />` instead of `<Calendar>` + overlay
- [x] Verify on mobile viewport: skeleton cells align with real calendar cells after load, no layout shift
- [x] Update `docs/domains/booking-widget.md` — note the `BookingCalendar` skeleton rendering contract change
