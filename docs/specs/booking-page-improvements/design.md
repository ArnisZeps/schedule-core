# Design: booking-page-improvements

## Problem

Four independent issues on the booking page at `/book/:tenantSlug` identified after M7 delivery:

1. **Today highlight clipped.** `DateStrip` marks today with `ring-1 ring-primary/40`. CSS `ring` is implemented as `box-shadow`, which extends outside the element's border box and is clipped by the parent `overflow-x-auto` container. The ring renders incomplete on the left/top/right edges.

2. **Days with no available slots still shown.** All 7 days appear in the strip regardless of availability. Clients must click each date to discover there are no slots. The M7 design accepted this trade-off (no pre-emptive indicators) but the UX is now explicitly unwanted.

3. **Trailing gap in date strip.** The 7 day buttons are `min-w-[2.75rem]` fixed-min-width inside a `flex-1` container. They do not stretch to fill the container width, leaving a visible gap between the last day and the `>` arrow.

4. **Services and staff fetch waterfall.** The SSR page pre-fetches only locations. Services are fetched client-side on mount (first round-trip). Staff is fetched only after a service is selected (second round-trip, sequential). Both produce content jumps.

Constraints: no ORM (ADR-004); public routes use explicit `WHERE tenant_id = $n` (no RLS); no new packages — React Query `initialData` covers the pre-fetch pattern.

---

## Components

### Modified files

| File | Change |
|------|--------|
| `apps/web/app/(public)/book/[tenantSlug]/page.tsx` | Also fetch `initialServices` and `initialStaffByService` server-side; pass to `BookingWidget` |
| `apps/web/src/page-components/booking/BookingWidget.tsx` | Accept `initialServices` and `initialStaffByService` props; forward as `initialData` to hooks; derive `currentStaffInitialData` from map for the selected service |
| `apps/web/src/page-components/booking/DateStrip.tsx` | (1) Replace `ring-1 ring-primary/40` with `border-2 border-primary/60`; (2) remove `overflow-x-auto`; (3) add `flex-1` to each day button; (4) accept `availableDates: Set<string> \| null` and hide days absent from the set |
| `apps/web/src/page-components/booking/DateTimeSection.tsx` | Call `usePublicAvailableDates`; pass result to `DateStrip` as `availableDates`; expose `windowStart` state so the hook re-fetches on navigation |
| `apps/web/src/page-components/booking/ServiceSection.tsx` | Add skeleton rows when `isLoading` (prevents zero-height section collapse) |
| `apps/web/src/page-components/booking/StaffSection.tsx` | Add skeleton rows when `isLoading && prerequisiteMet` (prevents zero-height collapse) |
| `apps/web/src/hooks/usePublicBooking.ts` | Add `initialData` parameter to `usePublicServices` and `usePublicStaff`; add new `usePublicAvailableDates` hook |

### New files

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/public/[tenantSlug]/services/[serviceId]/available-dates/route.ts` | `GET` — returns date strings with at least one available slot within a given window |

---

## Contracts

### New API endpoint

#### `GET /api/public/:tenantSlug/services/:serviceId/available-dates`

| Param | Required | Description |
|-------|----------|-------------|
| `locationId` | yes | Location to scope staff availability |
| `staffId` | no | Specific staff member; absent = any available |
| `startDate` | yes | YYYY-MM-DD — first date of window |
| `endDate` | yes | YYYY-MM-DD — last date of window |

Window is capped at 14 days server-side to bound compute.

**Response 200:**
```json
["2026-05-15", "2026-05-16", "2026-05-18"]
```
Array of date strings that have at least one slot with `available: true`. Empty array if none.

**Errors:** `400` missing required params or window > 14 days, `404` tenant or service not found.

Implementation: iterates each date in the window, calls `generateStaffSlots` or `generateAnyAvailableSlots` (reuses existing logic from `apps/web/src/lib/server/availability.ts`), appends the date if any slot has `available: true`.

---

### New `usePublicAvailableDates` hook

```ts
function usePublicAvailableDates(
  tenantSlug: string,
  serviceId: string | null,
  locationId: string | null,
  staffId: string | null,   // null = any available
  startDate: string | null, // YYYY-MM-DD, first day of current window
  staffSelected: boolean,
): UseQueryResult<string[]>
// enabled when staffSelected && serviceId && locationId && startDate are set
// queryKey includes startDate so the query re-runs when the window shifts
// endDate = startDate + 6 days (always a 7-day window)
```

`DateTimeSection` owns `windowStart` state (currently inside `DateStrip`). Moving window state up allows `DateTimeSection` to derive `startDate` and pass it to the hook, then pass `availableDates` as a `Set<string>` to `DateStrip`.

---

### `usePublicServices` / `usePublicStaff` changes

```ts
function usePublicServices(
  tenantSlug: string,
  initialData?: PublicService[],
): UseQueryResult<PublicService[]>

function usePublicStaff(
  tenantSlug: string,
  serviceId: string | null,
  locationId: string | null,
  initialData?: PublicStaffMember[],
): UseQueryResult<PublicStaffMember[]>
```

When `initialData` is provided, React Query treats it as the pre-fetched value and skips the initial network request (data is considered fresh until `staleTime` expires).

---

### `BookingWidget` new props

```ts
interface Props {
  tenantSlug: string
  tenantName: string
  initialLocations: PublicLocation[]
  initialServices: PublicService[]                           // new
  initialStaffByService: Record<string, PublicStaffMember[]> // new — keyed by serviceId
}
```

`initialStaffByService` is populated server-side for single-location tenants only. For multi-location tenants it is passed as `{}` and React Query fetches staff client-side as before.

---

### Server-side pre-fetch in `page.tsx`

Two additional queries run after the existing tenant + locations fetch:

**Services:**
```sql
SELECT id, name, description, duration_minutes AS "durationMinutes"
FROM services
WHERE tenant_id = $1
ORDER BY created_at
```

**Staff by service** (single-location tenants only — `locationId` is known at render time):
```sql
SELECT ss.service_id AS "serviceId", s.id, s.name
FROM staff_services ss
JOIN staff s ON ss.staff_id = s.id
WHERE ss.service_id = ANY($2)
  AND s.tenant_id = $1
  AND s.is_active = true
ORDER BY s.created_at
```

The result is grouped into `Record<string, PublicStaffMember[]>` before passing to `BookingWidget`.

For multi-location tenants, the staff query is skipped; `initialStaffByService` is `{}`.

---

### `DateStrip` changes

1. **Today highlight** — replace `ring-1 ring-primary/40` with `border-2 border-primary/60`. Border is within the box model; no clipping.

2. **Even distribution** — remove `overflow-x-auto` from the day container; add `flex-1` to each day button. Seven equal-flex buttons fill the container with no trailing gap. The `min-w-[2.75rem]` guard stays to prevent extreme narrow layouts.

3. **Available date filtering** — new optional prop `availableDates: Set<string> | null`.
   - `null` (still loading): show all 7 days (optimistic, same as current behaviour).
   - Non-null: hide days absent from the set.
   - If the filtered result has 0 visible days: show a "No available dates in this period" message with nav arrows still active.

4. **Window state moved up** — `windowStart` state moves from `DateStrip` into `DateTimeSection` so `DateTimeSection` can derive `startDate` for `usePublicAvailableDates`. `DateStrip` receives `windowStart`, `onPrev`, `onNext` as props.

---

## Rejected alternatives

**`overflow-visible` + padding hack to fix ring clipping** — fragile; relies on consuming component having no overflow ancestor. Switching today to `border-2` is clean and portable.

**Batch slot computation in a single SQL query for available-dates** — duplicates the slot-generation logic (working hours, exceptions, booking conflicts) in SQL. Reusing the existing `generateStaffSlots`/`generateAnyAvailableSlots` functions in a per-day loop is safe and auditable; the 14-day cap bounds compute.

**Pre-fetch all 60-day availability on page load** — 60 day-checks × potential staff members is too expensive. The 7-day window (re-fetched on nav) is proportionate.

**Pre-fetch staff for all locations** — for multi-location tenants, unknown which location will be selected; pre-fetching all is wasteful. Scoping to single-location covers the common case and the user's scenario.

**Global `staleTime: Infinity` for services/staff** — would prevent background refetch after staff changes. `initialData` with default stale time is sufficient; React Query refetches on window focus.

---

## Trade-offs accepted

- `available-dates` calls the slot generator per day in a loop (up to 14 iterations). Each iteration may do multiple DB queries. Capped at 14 days per request.
- Multi-location tenants still experience a staff-fetch round-trip after service selection. Server-side pre-fetch only covers single-location tenants.
- `initialStaffByService` may be slightly stale if assignments change between SSR and client hydration. React Query background re-validation corrects this.
- Moving `windowStart` state from `DateStrip` to `DateTimeSection` is a mild prop-drilling increase, but necessary for `usePublicAvailableDates` to respond to window navigation.

---

## Out of scope

- Availability indicators (dot, count) on date strip day numbers.
- Pre-fetching slots for all visible dates.
- Multi-location staff pre-fetch.
- Upstash rate limiting on `available-dates` (tracked separately — same prerequisite as other public endpoints).

---

## Edge cases

| Scenario | Handling |
|----------|----------|
| All 7 days in window have no slots | Strip shows empty state with nav arrows; `>` still navigates to next window |
| `availableDates` still loading | Strip shows all 7 days (optimistic; user may click a loading date but TimeSlotGrid empty state handles it) |
| Selected date shifts out of available set | `selectedDate` state in parent is preserved; TimeSlotGrid shows empty state if date has no slots |
| Single-location tenant, no services | `initialServices = []`; ServiceSection shows empty state on first paint |
| Staff added/removed after SSR | React Query refetches on window focus; updated staff appears without page reload |
| `available-dates` window > 14 days requested | API returns `400`; hook will not request > 7 days so this cannot occur in practice |
