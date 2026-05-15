# Tasks: Booking Calendar Picker

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-15 Implementation

- [x] Install shadcn Calendar component: `npx shadcn@latest add calendar` (adds `react-day-picker` dependency)
- [x] Raise `MAX_WINDOW_DAYS` from `14` to `31` in `available-dates/route.ts`; update the "window exceeds limit" test in `available-dates.test.ts` to use a window > 31 days
- [x] Update `usePublicAvailableDates` in `usePublicBooking.ts`: add `endDate` param, remove internal `+6 days` computation
- [x] Write RTL tests for `BookingCalendar` (skeleton loading state, available day selectable, unavailable day disabled, past date disabled, month navigation) — present to user and wait for approval before implementing
- [x] Write updated `BookingWidget` end-to-end RTL tests (date selection via calendar day buttons) — present to user and wait for approval
- [x] Implement `apps/web/src/page-components/booking/BookingCalendar.tsx`
- [x] Update `DateTimeSection.tsx`: replace `windowStart` state with `month: Date`, compute month boundaries for hook call, render `BookingCalendar`; clear `selectedDate` on month change (via `onDateSelect(null)` or equivalent reset in `BookingWidget`)
- [x] Delete `apps/web/src/page-components/booking/DateStrip.tsx`
- [x] Update `booking.test.tsx`: remove `DateStrip` describe block, add `BookingCalendar` describe block, update BookingWidget end-to-end tests
- [x] Run full test suite (`pnpm --filter web test` and `pnpm --filter web test:api`) — all tests green
- [x] Verify in browser via Playwright: open `/book/dev-business`, select service + location + staff, confirm calendar appears with correct available/unavailable days, month navigation works, slot grid loads on date click
- [x] Update `docs/domains/booking-widget.md`: remove `DateStrip` entries, add `BookingCalendar` component, update hook signature, update DateStrip behaviour section
