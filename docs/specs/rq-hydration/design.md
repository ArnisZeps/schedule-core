# Design: React Query SSR Hydration

## Problem

See `requirements.md`. Root cause in one sentence: `initialData` is a per-query-key fallback value, not a cache pre-population mechanism. Passing it from SSR props contaminates every key the hook is called with — including new week keys on navigation.

The industry-standard solution for Next.js + TanStack Query is `dehydrate`/`HydrationBoundary`.

## ADR conflict

**ADR-012 section 3** states: _"They receive initial data as props and may use React Query's `initialData` option for client-side re-fetching after mutations."_

This spec supersedes that guidance. See ADR-013 (written alongside this spec).

---

## Pattern overview

```
Server Component (page.tsx)
  1. makeQueryClient()                       — fresh QueryClient per request
  2. queryClient.setQueryData(key, data)     — pre-populate relevant keys
  3. dehydrate(queryClient)                  — serialize cache → plain object
  4. Pass dehydratedState to HydrationBoundary

Client Component (page-component/*.tsx)
  HydrationBoundary state={dehydratedState}  — deserializes into client QueryClient
    └─ hooks call useQuery() normally        — cache hit on first render
```

`HydrationBoundary` runs synchronously before children mount. Client component's first `useQuery` call finds data in the cache → `isLoading: false`, no skeleton.

---

## URL format change (appointments)

Current: `?date=YYYY-MM-DD` — ambiguous for week view (one day represents a seven-day range).

New: `?from=YYYY-MM-DD&to=YYYY-MM-DD` — explicit range matching the React Query key.

Day view keeps `?view=day&date=YYYY-MM-DD`. List view keeps `?view=list`.

**Why this matters for hydration**: the server reads `searchParams.from`/`to` and uses them as the React Query key. The client reads the same URL params and derives the same key. Cache hit guaranteed. If neither param is present (initial load, no URL), both server and client compute the current UTC Monday as default.

**UTC key construction**: ISO datetimes are built as `dateStr + 'T00:00:00.000Z'` — never `parseISO(dateStr).toISOString()`. `parseISO` returns local midnight; `.toISOString()` converts to UTC. In UTC+3 this would yield `'2026-05-03T21:00:00.000Z'` — a different string from the server's `'2026-05-04T00:00:00.000Z'`. Appending `T00:00:00.000Z` is timezone-safe on both server and client.

---

## Components

| File | Change |
|------|--------|
| `apps/web/src/lib/server/queryClient.ts` | **New.** `makeQueryClient()` factory — returns `new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } })`. Must be called per-request; never shared. |
| `apps/web/app/(dashboard)/appointments/page.tsx` | Read `searchParams.from`/`to`. Build keys as `from + 'T00:00:00.000Z'`. Call `makeQueryClient()`, `setQueryData` for bookings + services + locations + staff + service-staff keys. Pass `dehydrate(qc)` as `dehydratedState` prop to `AppointmentsPage`. |
| `apps/web/app/(dashboard)/services/page.tsx` | `makeQueryClient()`, `setQueryData(['services', tenantId], services)`, `dehydrate`. Pass `dehydratedState` to `ServiceListPage`. |
| `apps/web/app/(dashboard)/locations/page.tsx` | `makeQueryClient()`, `setQueryData(['locations', tenantId, { includeInactive: false }], locations)`, `dehydrate`. Pass `dehydratedState` to `LocationListPage`. |
| `apps/web/app/(dashboard)/staff/page.tsx` | `makeQueryClient()`, `setQueryData(['staff', tenantId, { includeInactive: false, locationId: undefined }], staff)`, `dehydrate`. Pass `dehydratedState` to `StaffListPage`. |
| `apps/web/src/page-components/appointments/AppointmentsPage.tsx` | Accept `dehydratedState` prop (type: `unknown`). Wrap return in `<HydrationBoundary state={dehydratedState}>`. Remove all `initial*` props. Remove `useMemo` cache seeding. Read `from`/`to` from URL params (not `date`). Compute ISO keys as `param + 'T00:00:00.000Z'`. |
| `apps/web/src/page-components/services/ServiceListPage.tsx` | Accept `dehydratedState` prop. Wrap return in `HydrationBoundary`. Remove `initialServices`. |
| `apps/web/src/page-components/locations/LocationListPage.tsx` | Accept `dehydratedState` prop. Wrap in `HydrationBoundary`. Remove `initialLocations`. |
| `apps/web/src/page-components/staff/StaffListPage.tsx` | Accept `dehydratedState` prop. Wrap in `HydrationBoundary`. Remove `initialStaff`. |
| `apps/web/src/hooks/useServices.ts` | Remove `initialData` param and option. Add `staleTime: 5 * 60_000` unconditionally. |
| `apps/web/src/hooks/useLocations.ts` | Remove `initialData` param from `useLocations`. Add `staleTime: 5 * 60_000` unconditionally. |
| `apps/web/src/hooks/useStaff.ts` | Remove `initialData` param from `useStaffList`. Add `staleTime: 5 * 60_000` unconditionally. |
| `apps/web/src/hooks/useBookings.ts` | Remove `initialData` from `useBookings` params. Add `staleTime: 30_000` unconditionally. |
| `apps/web/src/hooks/useBookingsPrefetch.ts` | Replace `startOfWeek`/`endOfWeek` with direct ISO arithmetic: prev period = `new Date(new Date(from).getTime() ± N * 86400000).toISOString()`. Keys must align with main `useBookings` key. |
| `apps/web/src/test/dashboard-ssr-phase2.test.tsx` | Replace `initial*` prop passing with `dehydrate`/`HydrationBoundary` setup. Update `beforeEach` URL: `view=week&from=2026-05-04&to=2026-05-11`. |
| `apps/web/src/test/appointments.test.tsx` | Update URL format to `from`/`to`. Add regression test: navigate to next week → correct bookings shown. |

---

## Contracts

### `makeQueryClient()`
```ts
// apps/web/src/lib/server/queryClient.ts
import { QueryClient } from '@tanstack/react-query'
export function makeQueryClient(): QueryClient
```

### `AppointmentsPage` props (after)
```ts
interface AppointmentsPageProps {
  dehydratedState?: unknown
}
```

### `ServiceListPage` / `LocationListPage` / `StaffListPage` props (after)
```ts
interface ServiceListPageProps { dehydratedState?: unknown }
interface LocationListPageProps { dehydratedState?: unknown }
interface StaffListPageProps { dehydratedState?: unknown }
```

### React Query keys (unchanged; listed for dehydrate alignment)

| Hook | Key |
|------|-----|
| `useBookings` | `['bookings', tenantId, { from, to, serviceId }]` |
| `useServices` | `['services', tenantId]` |
| `useLocations(true)` | `['locations', tenantId, { includeInactive: true }]` |
| `useLocations(false)` | `['locations', tenantId, { includeInactive: false }]` |
| `useStaffList()` | `['staff', tenantId, { includeInactive: false, locationId: undefined }]` |
| `useServiceStaff(sId, lId)` | `['service-staff', tenantId, sId, lId]` |

---

## Rejected alternatives

**`setQueryData` in `useMemo`** — semantic misuse (`useMemo` is for values, not side effects). React may skip or repeat memos in concurrent mode. This is what the current codebase does and is being replaced.

**`initialData` option** — correct for simple client-side defaults but contaminates dynamic query keys on navigation. Every new `from`/`to` pair on the appointments page gets `initialData` = SSR week's bookings, causing the "disappearing appointments" bug.

**`getQueryClient()` singleton with `cache()`** — Next.js's `cache()` gives per-request memoisation. Viable but more indirection than a plain factory function with no benefit at current scale.

**Threading `dehydratedState` through RSC tree without a prop** — not possible without context, which requires a Client Component boundary. Prop is the correct RSC pattern.

---

## Trade-offs accepted

- Each dashboard page Server Component creates a local `QueryClient` that is discarded after `dehydrate`. Memory cost is negligible (one JS object per request, GC'd after response).
- `dehydratedState` prop is typed as `unknown` to avoid importing `DehydratedState` into Client Component files that would otherwise be server-only. TanStack Query accepts `unknown` for `HydrationBoundary.state`.

---

## Out of scope

- Streaming SSR / Suspense-based deferred hydration — all queries pre-populated synchronously on the server.
- Shared layout-level `QueryClient` provider (e.g. pre-populating common data in `layout.tsx`).
- Invalidation-on-focus / refetchOnWindowFocus tuning — not changed.

---

## Edge cases

- **No URL params (initial navigation to `/appointments`)** — both server and client independently compute current UTC Monday as `from`, next Monday as `to`. Keys match.
- **`from`/`to` params present but invalid** — client falls back to today's week. Server should also fall back (parse → invalid → use today).
- **Day view** — unaffected by `from`/`to` URL change; uses `?view=day&date=` which is already unambiguous. `useBookings` key for day view: `{ from: date + 'T00:00:00.000Z', to: nextDay + 'T00:00:00.000Z' }`.
- **`serviceId` filter** — appointments page with active service filter: both server and client include `serviceId` in key; server passes it to the bookings query.
- **`useBookingsPrefetch` for day view** — prev/next are adjacent days. ISO arithmetic: `new Date(new Date(from).getTime() ± 86400000).toISOString()`. Same UTC-safe approach.
