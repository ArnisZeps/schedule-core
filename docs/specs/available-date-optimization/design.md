# Design: Available Date Optimization

## Problem

`GET /api/public/:tenantSlug/services/:serviceId/available-dates` is slow (~3s for a 7-day window).

The root cause is that the route handler loops over each day sequentially, and for each day calls `generateAnyAvailableSlots`, which in turn loops over each staff member sequentially and calls `generateStaffSlots` — which fires 4 DB round trips per staff member per day.

**Query count:** `days × staff × 4 = 7 × 3 = 84` queries at ~25ms each ≈ **2.1s+ in DB time alone**, before compute or cold-start overhead.

The fix is a dedicated batch function that issues at most 4 queries for the entire window — regardless of window size or staff count — and performs all slot computation in memory using pre-fetched data.

No schema changes are needed. Existing indexes on `staff_schedules(staff_id)`, `staff_schedule_overrides(staff_id, start_date, end_date)`, and `bookings(staff_id)` already support range queries efficiently.

There is also an incidental `console.log` in `slotsForWindows` (availability.ts:36) that must be removed.

## Components

| File | Change |
|------|--------|
| `apps/web/src/lib/server/availability.ts` | Export `slotsForWindows` (currently private). Add `generateAvailableDatesInWindow`. |
| `apps/web/app/api/public/[tenantSlug]/services/[serviceId]/available-dates/route.ts` | Replace the sequential day loop with a single call to `generateAvailableDatesInWindow`. |

`generateStaffSlots` and `generateAnyAvailableSlots` are **not modified** — they remain in use by the `slots` endpoint.

## Contracts

### New export: `slotsForWindows`

Currently a private function. Export it unchanged so `generateAvailableDatesInWindow` can reuse it.

```ts
export function slotsForWindows(
  windows: Array<{ start_time: string; end_time: string }>,
  blockOverrides: Array<{ start_time: string; end_time: string }>,
  bookedRows: Array<{ start_at: Date; end_at: Date }>,
  date: string,
  durationMinutes: number,
  timezone: string,
): Array<{ startAt: string; endAt: string; available: boolean }>
```

### New export: `generateAvailableDatesInWindow`

```ts
export async function generateAvailableDatesInWindow(
  client: PoolClient,
  params: {
    tenantId: string;
    serviceId: string;
    locationId: string;
    staffId: string | null;   // null = any available staff
    startDate: string;        // YYYY-MM-DD, inclusive
    endDate: string;          // YYYY-MM-DD, inclusive
    durationMinutes: number;
    timezone: string;         // IANA — from the location row
  },
): Promise<string[]>          // sorted YYYY-MM-DD strings; only dates with ≥1 available slot
```

**Internal DB queries (all issued inside the existing RLS tenant context):**

1. **Staff list** — if `staffId` is null, `SELECT id FROM staff JOIN staff_services WHERE service_id AND tenant_id AND location_id AND is_active`. If `staffId` provided, use it directly (no query).
2. **Schedules** — `SELECT staff_id, day_of_week, start_time, end_time FROM staff_schedules WHERE staff_id = ANY($staffIds) AND day_of_week = ANY($daysInWindow)`.
3. **Overrides** — `SELECT staff_id, type, start_time, end_time, start_date, end_date FROM staff_schedule_overrides WHERE staff_id = ANY($staffIds) AND start_date <= $endDate AND end_date >= $startDate`.
4. **Bookings** — `SELECT staff_id, start_at, end_at FROM bookings WHERE staff_id = ANY($staffIds) AND status != 'cancelled' AND start_at < $windowEndUTC AND end_at > $windowStartUTC`.

After fetching, all slot computation is in-memory:
- For each date in the window, compute the day-of-week and UTC midnight boundary using `localMidnightUTC`.
- For each staff member, filter pre-fetched schedules/overrides/bookings to the date, clip overrides via `clipOverrideWindow`, call `slotsForWindows`.
- If any slot has `available: true` across any staff member for that date, include the date and move to the next (short-circuit).

### Route handler changes

`available-dates/route.ts` gains calls to fetch `durationMinutes` (service query) and `timezone` (location query) — both already done individually. These remain as two separate queries before the tenant context, then `generateAvailableDatesInWindow` is called once inside `withTenantContext`.

The outer sequential `for` loop and per-date `await` are removed entirely.

## Rejected alternatives

**`Promise.all` on the existing day loop**
Reduces wall time by parallelising days, but total DB load remains O(days × staff × 4). On Neon serverless, concurrent queries compete for the pool. This is a partial fix that adds concurrency complexity without addressing the root cause.

**`Promise.all` on the staff loop inside `generateAnyAvailableSlots`**
Same issue — still one query set per staff per day. Also requires modifying a function shared with the `slots` endpoint, coupling two unrelated use cases.

**Modify `generateStaffSlots` to accept pre-fetched data as optional parameters**
Complicates the shared function's interface. The `slots` endpoint issues per-day queries and that is fine (it fetches a single date). Merging the two use cases into one function creates an awkward optional-data contract.

**Response-level caching (Redis, CDN)**
Correct for production scale, but premature for MVP. The batch query approach brings latency to an acceptable level and is simpler. Caching can be layered later without changing this design.

## Trade-offs accepted

- The batch bookings query may return slightly more rows than strictly necessary (bookings whose `start_at` is within the window but whose staff member has no schedule on that date). These are filtered in memory and add negligible overhead.
- `slotsForWindows` becomes part of the public API of `availability.ts`. It must not be modified without considering `generateAvailableDatesInWindow` as a caller.

## Out of scope

- Optimising the `slots` endpoint (single-date queries are fast by nature).
- Adding DB indexes (existing indexes are sufficient).
- Response caching at the HTTP or CDN layer.
- Changing the 14-day max-window cap — it remains enforced in the route handler.

## Edge cases

| Case | Handling |
|------|----------|
| No staff assigned to service at location | Staff query returns empty → return `[]` immediately, skip remaining queries |
| Staff has no schedule rows and no add-overrides for any day in the window | Schedule query returns empty per staff → `slotsForWindows` called with empty `windows` → no slots → date excluded |
| Block override covers entire day | `slotsForWindows` produces zero non-blocked slots → date excluded |
| Booking fills the only available slot | `bookedRows` overlap check marks that slot unavailable → if no other slot exists, date excluded |
| Timezone boundary (e.g. UTC+12, booking at 11pm UTC lands on next local date) | `localMidnightUTC` computes correct UTC bounds per date; batch booking query fetches all bookings in the UTC-equivalent window; in-memory filtering uses the same midnight anchor |
| `startDate === endDate` (single day) | `daysInWindow = [dayOfWeek]`; all queries work correctly; returns at most one date |
| All days in window are the same day-of-week (e.g. 14-day window Mon–Mon) | `daysInWindow` deduplicates; `ANY($daysInWindow)` still correct |
