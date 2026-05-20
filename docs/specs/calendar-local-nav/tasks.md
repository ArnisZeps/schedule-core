# Tasks: calendar-local-nav

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-20 Initial implementation

- [x] Update `AppointmentsPage.tsx` — replace `useSearchParams` reads with `useState`; init state from URL params; add `router.replace` sync effect; remove `useTransition`/`startNavigation`/`isNavigating`; pass nav callbacks to `CalendarToolbar`
- [x] Update `CalendarToolbar.tsx` — remove `useSearchParams`/`useRouter`/`router.push`; accept `view`, `dateStr`, `serviceId`, `selectedStaffId`, `onNavigate`, `onViewChange`, `onServiceChange`, `onStaffChange` as props
- [x] Remove `className` prop from `WeekView.tsx` and `DayView.tsx`
- [x] Verify no regressions: `pnpm --filter web test`
- [x] Update `docs/domains/bookings.md` to reflect that calendar nav state is local
