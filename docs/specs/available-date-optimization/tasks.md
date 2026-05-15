# Tasks: Available Date Optimization

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-15 Implementation

- [x] Remove the `console.log` from `slotsForWindows` in `availability.ts` (line 36)
- [x] Write unit tests for `generateAvailableDatesInWindow` covering: no staff, no schedule, add-override adds availability, block-override removes availability, booking fills only slot, timezone boundary, single-day window — present to user and wait for approval before implementing
- [x] Export `slotsForWindows` from `availability.ts`
- [x] Implement `generateAvailableDatesInWindow` in `availability.ts`
- [x] Update `available-dates/route.ts` to call `generateAvailableDatesInWindow` (remove the sequential day loop)
- [x] Run full test suite (`pnpm --filter web test`) — all tests green
- [x] Verify in browser via Playwright: open `/book/:slug`, select service + staff, confirm date strip loads in under 2s and available dates are correct
- [x] Update `docs/domains/booking-widget.md` — document `generateAvailableDatesInWindow` under the API section
