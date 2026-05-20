# Design: calendar-prefetch

## Problem

Each time the user navigates to a different week or day, `useBookings` fires a new API request because the query key changes (the date range changes). The API round trip takes 2–3 seconds, leaving the user watching an empty or loading calendar. The data for adjacent periods is predictable — the user is almost always going to look at the previous or next period — so it can be silently fetched in the background while they are viewing the current one.

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/src/hooks/useBookingsPrefetch.ts` | New hook. Accepts current view state; fires background `prefetchQuery` calls for adjacent date ranges after current data renders. |
| `apps/web/src/page-components/appointments/AppointmentsPage.tsx` | Call `useBookingsPrefetch` after the current `useBookings` call. |

## Contracts

### `useBookingsPrefetch`

```ts
function useBookingsPrefetch(params: {
  view: 'week' | 'day' | 'list'
  from: string      // ISO 8601 — start of current range
  to: string        // ISO 8601 — end of current range
  serviceId?: string
  tenantId: string
}): void
```

- Uses `useQueryClient()` to get the React Query client.
- Inside a `useEffect` keyed on `[view, from, to, serviceId, tenantId]`, calls `queryClient.prefetchQuery` for the previous and next periods.
- Query key and fn must match those used in `useBookings` exactly: `['bookings', tenantId, { from, to, serviceId }]`.
- `staleTime: 30_000` passed to `prefetchQuery` — consistent with `useBookings`.
- `list` view has no adjacent periods to prefetch (it shows upcoming bookings from now). Skip silently.

### Adjacent range computation

- **Week view:** prev = week starting 7 days before `from`; next = week starting 7 days after `from`. Use `addDays` / `startOfWeek` / `endOfWeek` from `date-fns` (already a dependency).
- **Day view:** prev = `from` minus 1 day; next = `from` plus 1 day. Use `addDays`.

## Rejected alternatives

**Prefetch in the Server Component (`appointments/page.tsx`)** — would require 3× the bookings queries on every hard navigation (current + prev + next). Adds DB load for a problem that only manifests on client-side navigation. Rejected.

**Wider fetch range (e.g., 3 weeks at once, filter client-side)** — increases payload for the common case where the user only views one week. Does not help for arbitrary jumps. Rejected.

**`useInfiniteQuery` with bi-directional pagination** — designed for scroll-based pagination, not keyboard/button date navigation. Adds significant complexity with no benefit here. Rejected.

**Prefetch on hover of prev/next button** — more precise trigger, but adds event handler coupling to `CalendarToolbar`. The `useEffect`-on-render approach prefetches slightly earlier and requires no UI changes. Rejected.

## Trade-offs accepted

- Prefetch fires 2 extra API requests on every view change, including when the user does not navigate further. For a low-traffic internal tool this is acceptable. A hover-intent approach would be more efficient but more complex.
- `list` view is excluded — its query (`useUpcomingBookings`) has no concept of adjacent periods.

## Out of scope

- Prefetching services, staff, locations — these are reference data with `staleTime: 5 minutes`; they are already in cache after first load.
- Prefetching more than one period ahead (e.g., two weeks forward).
- SSR prefetch of adjacent periods.

## Edge cases

- **Service filter active (`serviceId` set):** prefetch uses the same `serviceId`, so cached data matches the active filter when the user navigates.
- **View switches (week → day):** `from`/`to` changes entirely; previous prefetch entries remain in cache unused but do not cause errors.
- **Rapid navigation:** `prefetchQuery` is a no-op if the query is already in-flight or fresh in cache. No duplicate requests.
- **Mutation (new/cancelled booking):** `queryClient.invalidateQueries({ queryKey: ['bookings'] })` clears all booking cache entries including prefetched ones. Next navigation re-fetches as normal.
