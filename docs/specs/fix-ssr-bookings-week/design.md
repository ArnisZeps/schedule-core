# Design: fix-ssr-bookings-week

## Problem

Appointments intermittently disappear from the week-view calendar. Root cause is a mismatch between what `page.tsx` pre-fetches on the server and what `AppointmentsPage` displays on the client. A secondary issue — the URL using a single `?date=` for week view — is misleading and also causes a query-key timezone mismatch. Both are fixed together.

**Primary root cause:**

1. User navigates to `/appointments?date=2026-05-30` (a week other than the current week).
2. `page.tsx` (server) ignores the URL date and always computes `from`/`to` from `new Date()` — the current week. It fetches current-week bookings and passes them as `initialBookings`.
3. `AppointmentsPage` (client) reads `?date=2026-05-30` and computes `from`/`to` for the week of May 25–31. It calls `useBookings({ from, to, initialData: initialBookings })`.
4. React Query stores `initialBookings` (current-week data) under the query key for the May 25–31 range.
5. With `staleTime: 30_000` and `initialDataUpdatedAt: Date.now()`, React Query suppresses any background refetch for 30 seconds.
6. `WeekView` renders only bookings within the visible May 25–31 range. The current-week bookings sitting in the cache are outside this range → invisible → calendar appears empty or partial.

**Intermittency:** When `useBookingsPrefetch` had already cached the requested week from a prior navigation, the cache has correct data and `initialData` is ignored. On direct URL load or hard refresh with an empty cache, the wrong `initialData` is used.

**Secondary issue (URL clarity + query-key mismatch):**

`/appointments?date=2026-05-30` is ambiguous for a week view — `date` is a day within the week, not the week's range. Additionally, `AppointmentsPage` derives week boundaries via `startOfWeek(parseISO(dateStr))` which in a non-UTC browser timezone (e.g. UTC+3) produces a different ISO timestamp than the same computation run server-side in UTC. This means the React Query key the client computes (`from=2026-05-24T21:00:00.000Z`) differs from what the server queried (`from=2026-05-25T00:00:00.000Z`), breaking the `initialData` cache population.

**Fix:**

1. Change week-view URL to use explicit date boundaries: `?view=week&from=2026-05-25&to=2026-05-31` (YYYY-MM-DD, Monday–Sunday inclusive).
2. `AppointmentsPage` reads `from`/`to` directly from the URL for week view; writes them back on navigation. React Query key is built from `parseISO(fromParam).toISOString()` — no `startOfWeek` call needed, same result server and client.
3. `page.tsx` reads `searchParams.from` and `searchParams.to`, converts to ISO timestamps the same way as the client → server fetches exactly the week being displayed → `initialBookings` matches → no stale-cache mismatch.

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/app/(dashboard)/appointments/page.tsx` | Accept `searchParams` prop; read `from`/`to` date strings; compute ISO timestamps via `parseISO(from).toISOString()` (fall back to current week if absent/invalid) |
| `apps/web/src/page-components/appointments/AppointmentsPage.tsx` | Week view: initialise state from `?from`/`?to` URL params (fall back to current week); write `from`/`to` YYYY-MM-DD to URL on navigation. Day view: keep `?date=YYYY-MM-DD` unchanged. Build React Query `from`/`to` timestamps with `parseISO(weekFrom).toISOString()` rather than `startOfWeek(parseISO(dateStr))`. |

`useBookings`, `useBookingsPrefetch`, and all calendar view components are unchanged.

## Contracts

**URL format (week view):**

```
/appointments?view=week&from=2026-05-25&to=2026-05-31
```

- `from` — Monday of the displayed week, YYYY-MM-DD
- `to` — Sunday of the displayed week, YYYY-MM-DD
- Both absent → defaults to current week (Monday–Sunday)
- `view=week` is still omitted when it is the default view (existing behaviour)

**URL format (day view — unchanged):**

```
/appointments?view=day&date=2026-05-04
```

**`page.tsx` searchParams prop:**

```ts
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; date?: string; view?: string }>
})
```

Internal date derivation (week):

```ts
const sp = await searchParams
const fromParam = sp.from
const toParam = sp.to
const fromDate = fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : startOfWeek(new Date(), { weekStartsOn: 1 })
const toDate = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : endOfWeek(new Date(), { weekStartsOn: 1 })
const from = fromDate.toISOString()
const to = addDays(toDate, 1).toISOString()  // exclusive upper bound for the SQL query
```

**`AppointmentsPage` state initialisation (week view):**

```ts
// Read from URL on mount
const fromParam = params.get('from')   // YYYY-MM-DD Monday
const toParam   = params.get('to')     // YYYY-MM-DD Sunday

// Derive React Query timestamps (same computation as server)
const weekFrom = (fromParam && isValid(parseISO(fromParam)))
  ? fromParam
  : format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
const weekTo = (toParam && isValid(parseISO(toParam)))
  ? toParam
  : format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

// React Query key uses these directly converted to ISO
const from = parseISO(weekFrom).toISOString()
const to = addDays(parseISO(weekTo), 1).toISOString()
```

URL sync writes `from`/`to` for week view; `date` for day view.

## Rejected alternatives

**Keep `?date=` param, just align server computation** — fixes the stale-cache bug but does nothing for the misleading URL and leaves the timezone key mismatch in place. Rejected: the URL change is low cost and solves two problems.

**Remove `initialData` entirely** — eliminates the mismatch but loses SSR pre-population (skeleton/spinner on first load). Rejected: SSR benefit is worth keeping when data is correct.

**Reduce `staleTime` to 0** — triggers immediate background refetch, masking the symptom. Rejected: hides root cause, wastes a network round-trip on every load.

## Trade-offs accepted

`?view=week` continues to be omitted from the URL when it is the default view. `from`/`to` are always written explicitly for week view to make the range unambiguous.

## Out of scope

- Day view URL (keep `?date=`)
- Timezone-aware slot boundaries (fetching bookings in the business's configured timezone rather than UTC)
- List view URL params

## Edge cases

- `?from` absent, `?to` absent (e.g. `/appointments` with no params): derive current week from `new Date()` — identical to current behaviour.
- `?from` is an invalid date string: treat as absent, fall back to current week.
- `?from` present, `?to` absent: derive `to` as `from + 6 days`.
- User bookmarks a week URL: navigates correctly to the exact week on reload.
- `view=day` with `?from`/`?to` in URL (unlikely, e.g. pasted link): ignore `from`/`to`, read `?date` as before.
