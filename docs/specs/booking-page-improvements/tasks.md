# Tasks: booking-page-improvements

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-15 Initial implementation

### Fix 1 — Today highlight clipping (DateStrip)
- [x] Write RTL tests: today's date button has `border-2` class (not ring); no `overflow-x-auto` on container
- [x] Implement: replace `ring-1 ring-primary/40` with `border-2 border-primary/60`; remove `overflow-x-auto` from day container

### Fix 2 — Trailing gap (DateStrip)
- [x] Write RTL tests: each day button has `flex-1`; 7 buttons render inside container
- [x] Implement: add `flex-1` to each day button; remove `min-w` in favour of flex distribution

### Fix 3 — Available dates filtering
- [x] Write unit tests for `available-dates` route handler: returns only dates with available slots; respects 14-day cap; 400 on missing params; 404 on unknown tenant
- [x] Write RTL tests: DateStrip hides dates not in `availableDates`; shows empty state when set is empty; shows all days when `availableDates` is null
- [x] Move `windowStart` state from `DateStrip` to `DateTimeSection`; add `windowStart`/`onPrev`/`onNext` props to `DateStrip`
- [x] Implement `GET .../available-dates` route handler
- [x] Add `usePublicAvailableDates` hook to `usePublicBooking.ts`
- [x] Wire `DateTimeSection` → `usePublicAvailableDates` → `DateStrip`

### Fix 4 — Server-side pre-fetch (services + staff)
- [x] Write RTL tests: ServiceSection renders service cards without triggering a fetch; StaffSection renders staff cards immediately after service selection (single-location)
- [x] Update `usePublicServices` and `usePublicStaff` hooks to accept `initialData` param
- [x] Add services + staff-by-service queries to `page.tsx`; pass `initialServices` and `initialStaffByService` to `BookingWidget`
- [x] Update `BookingWidget` to accept and forward new props
- [x] Add loading skeletons to `ServiceSection` and `StaffSection` (prevents zero-height collapse for multi-location tenants that still fetch client-side)

### Close-out
- [x] Verify in browser with Playwright MCP: today highlight visible, no trailing gap, days filtered, no content jump on load
- [x] Update `docs/domains/booking-widget.md` to reflect new API endpoint, prop signatures, hook signatures, and DateStrip behaviour
