# Tasks: calendar-prefetch

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-19 Initial implementation

- [x] Create `apps/web/src/hooks/useBookingsPrefetch.ts` — prefetches prev/next period booking ranges in background using `queryClient.prefetchQuery`
- [x] Call `useBookingsPrefetch` in `AppointmentsPage.tsx` after the current `useBookings` call
- [x] Verify no regressions: `pnpm --filter web test`
- [x] Update `docs/domains/bookings.md` to document `useBookingsPrefetch`
