# Tasks: fix-ssr-bookings-week

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-23 Initial implementation

- [x] Update week-view URL navigation tests in `appointments.test.tsx`: change assertions that check for `?date=` to expect `?from=`/`?to=` YYYY-MM-DD params; add a test that verifies `initialBookings` outside the visible week range do not render
- [x] Change `AppointmentsPage.tsx`: initialise week-view state from `?from`/`?to` URL params (fall back to current week when absent/invalid); write `from`/`to` YYYY-MM-DD to URL on week-view navigation; derive React Query `from`/`to` ISO timestamps via `parseISO(weekFrom).toISOString()` (remove `startOfWeek(parseISO(dateStr))` for the query-key computation)
- [x] Change `page.tsx`: accept `searchParams` prop (`Promise<{ from?: string; to?: string; date?: string; view?: string }>`); derive target week from `searchParams.from`/`to` (fall back to current week); compute `from`/`to` ISO timestamps the same way as the client (`parseISO(fromParam).toISOString()`)
- [x] Verify all existing tests pass after the change

- [x] Change `useBookings`: remove `initialData` parameter; make `staleTime: 30_000` unconditional; cache seeding moved to `AppointmentsPage` `useMemo`
- [x] Update `bookings.md` domain doc

## Discovered during implementation
- [x] Root cause was broader than the design: passing `initialData` to `useBookings` on every render contaminated the cache for any newly-navigated week, not just on page reload. Fixed by switching to `setQueryData` in `useMemo` (seeds cache once) and removing `initialData` from the hook.
- [ ] `useBookingsPrefetch` still uses `startOfWeek`/`endOfWeek` for adjacent-week computation, so prefetch query keys remain timezone-misaligned in non-UTC browsers (pre-existing, out of scope per design.md)
