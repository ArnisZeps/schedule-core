# Requirements: React Query SSR Hydration

## Problem

Dashboard pages use two ad-hoc patterns to pass server-fetched data to Client Component islands:

1. **`initialData` props threading** — pages pass `initial*` props to page-components, which forward them to hooks as `initialData`. This has a critical correctness bug on the appointments page: `initialData` is tied to a React Query key. When the user navigates to a different week, the new key has `initialData` = the SSR week's bookings. React Query considers this data as fresh and doesn't fetch the new week's real data until the 30-second stale window expires. Bookings disappear on week navigation.

2. **`useMemo` cache seeding** — `AppointmentsPage` calls `queryClient.setQueryData(...)` inside `useMemo(() => { ... }, [])`. `useMemo` is for derived values, not side effects. React may discard or re-execute memos. This is undefined behaviour.

TanStack Query ships a first-class solution for this: `dehydrate` on the server, `HydrationBoundary` on the client.

## User stories

- As a dashboard user, I want the page to show my data immediately on first load without any skeleton flash, so the UI feels instant.
- As a dashboard user, I want navigating between weeks to show the correct week's bookings immediately, so I don't see stale data.

## Acceptance criteria

- [ ] Navigating to `/appointments` shows the current week's bookings on first render with no loading skeleton.
- [ ] Navigating to the next or previous week (via Prev/Next buttons) shows that week's real data — not the SSR week's data replayed from `initialData`.
- [ ] Refreshing `/appointments?from=2026-05-11&to=2026-05-18` (a non-current week) pre-fetches and renders the correct bookings for that week, not the current week's bookings.
- [ ] `/services`, `/locations`, and `/staff` pages render their lists immediately on first load with no skeleton flash.
- [ ] No `initial*` props exist on any dashboard page-component.
- [ ] No `initialData` option used in any hook.
- [ ] `useMemo` is not used for cache seeding in any component.
- [ ] All existing tests pass; new regression tests for week-navigation correctness are added and green.
- [ ] Week view URL format is `?from=YYYY-MM-DD&to=YYYY-MM-DD`. The former `?date=YYYY-MM-DD` format is removed.
