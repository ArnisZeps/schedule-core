# ADR-013 — React Query SSR Hydration via dehydrate/HydrationBoundary

**Date:** 2026-05-23
**Status:** Proposed
**Amends:** ADR-012 (section 3 — "initialData option for client-side re-fetching")

---

## Context

ADR-012 established the dashboard SSR pattern: Server Components fetch data and pass it as `initial*` props to Client Component islands, which forward it to React Query hooks via the `initialData` option.

Two correctness problems surfaced in implementation:

1. **`initialData` contaminates dynamic keys.** The appointments calendar renders bookings for a date range. On week navigation, `AppointmentsPage` re-renders with a new `from`/`to`. Because `initialData` is applied at call-site unconditionally, the new week's query key receives the SSR week's bookings as `initialData`. React Query treats this as fresh data (within `staleTime`). The real bookings for the new week are never fetched until the stale window expires. Bookings appear to vanish on navigation.

2. **`useMemo` used for cache seeding is undefined behaviour.** `AppointmentsPage` seeded the `service-staff` cache via `useMemo(() => { queryClient.setQueryData(...) }, [])`. `useMemo` is for derived values. React may skip or re-execute memos in Strict Mode and concurrent renders.

TanStack Query provides a first-class solution: `dehydrate`/`HydrationBoundary`. The server serialises its pre-populated cache into a plain object; `HydrationBoundary` deserialises it into the client-side `QueryClient` synchronously before children mount.

---

## Decision

Replace the `initialData` prop-threading pattern with `dehydrate`/`HydrationBoundary` on all dashboard pages.

### Server side

Each dashboard page Server Component:
1. Creates a per-request `QueryClient` via `makeQueryClient()` (never shared across requests).
2. Calls `queryClient.setQueryData(key, data)` for all queries the page pre-fetches.
3. Calls `dehydrate(queryClient)` and passes the result as a `dehydratedState` prop to the Client Component root.

### Client side

Client Component islands:
1. Accept `dehydratedState?: unknown`.
2. Wrap their return in `<HydrationBoundary state={dehydratedState}>`.
3. Call `useQuery` hooks normally — no `initialData` option.

On first render, `HydrationBoundary` populates the client `QueryClient` cache. Every `useQuery` call finds its data already present → `isLoading: false`, no skeleton, no extra network request.

### What is removed

- `initial*` props from all dashboard page-components.
- `initialData` option from all hooks (`useServices`, `useLocations`, `useStaffList`, `useBookings`).
- `useMemo` cache seeding in `AppointmentsPage`.

### staleTime

Hooks that formerly set `staleTime` conditionally on `initialData` now set it unconditionally:

| Hook | `staleTime` |
|------|------------|
| `useServices` | 5 min |
| `useLocations` | 5 min |
| `useStaffList` | 5 min |
| `useBookings` | 30 s |

---

## Rejected alternatives

**Keep `initialData` with per-render guard** — would require conditional call-site detection of whether the current key matches the SSR key. Fragile, not composable, not how the option is intended to work.

**`setQueryData` in `useEffect`** — runs after paint; user sees skeleton on first render. Defeats the purpose.

**`setQueryData` in `useMemo`** — semantic misuse; undefined behaviour in concurrent React.

---

## Consequences

- `initial*` prop interfaces are removed from four page-components. SSR-seeded test suite (`dashboard-ssr-phase2.test.tsx`) must be updated to use `dehydrate`/`HydrationBoundary` directly.
- ADR-012's "may use React Query's `initialData` option" guidance is superseded. All other ADR-012 decisions stand (Server Components, cookie auth, middleware, UserProvider).
- The `@tanstack/react-query` package already installed exports `dehydrate`, `HydrationBoundary` — no new dependency.
