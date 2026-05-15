# Design: Booking Calendar Picker

## Problem

The current `DateStrip` shows only the dates that have available slots inside a 7-day rolling window. This produces inconsistent page sizes (0–7 visible dates), gives no sense of the surrounding calendar structure, and requires many navigation clicks to reach a date more than a week away. A full month calendar solves all three problems: it shows a familiar grid, always renders 28–31 days, and makes unavailability visually obvious without hiding information.

## Components

| File | Change |
|------|--------|
| `apps/web/src/components/ui/calendar.tsx` | Add via `npx shadcn@latest add calendar` (installs `react-day-picker`) |
| `apps/web/src/page-components/booking/BookingCalendar.tsx` | **New.** Thin wrapper around shadcn `Calendar`. Receives `availableDates`, `selectedDate`, `month`, callbacks; passes disabled/modifiers props into the shadcn component. |
| `apps/web/src/page-components/booking/DateStrip.tsx` | **Delete.** Fully replaced. |
| `apps/web/src/page-components/booking/DateTimeSection.tsx` | Replace `windowStart: number` state with `month: Date` (first day of current month). Compute `startDate`/`endDate` as month boundaries. Call `usePublicAvailableDates` with both dates. Render `BookingCalendar` instead of `DateStrip`. |
| `apps/web/src/hooks/usePublicBooking.ts` | `usePublicAvailableDates`: add `endDate` param; remove internal `+6 days` computation. |
| `apps/web/app/api/public/[tenantSlug]/services/[serviceId]/available-dates/route.ts` | `MAX_WINDOW_DAYS`: `14` → `31`. |
| `apps/web/src/test/api/available-dates.test.ts` | Update "window exceeds limit" test: use a window > 31 days. |
| `apps/web/src/test/booking.test.tsx` | Remove `DateStrip` describe block. Add `BookingCalendar` describe block. Update BookingWidget end-to-end tests (day selection changes from strip buttons to calendar day buttons). |
| `docs/domains/booking-widget.md` | Update component table, DateStrip behaviour section, API available-dates section. |

## Contracts

### `BookingCalendar` props

```ts
interface Props {
  availableDates: Set<string> | null  // null = loading
  selectedDate: string | null
  onSelect: (date: string) => void
  month: Date                         // controlled: first day of displayed month
  onMonthChange: (month: Date) => void
  minMonth: Date                      // earliest navigable month (= start of today's month)
  maxMonth: Date                      // latest navigable month (= start of today's month + 3)
}
```

Internal behaviour:
- Disabled matcher: `(date) => !availableDates?.has(toDateStr(date)) || date < today`
- While `availableDates === null`: all days disabled + skeleton overlay rendered on top of the calendar.
- `selected`: the Date parsed from `selectedDate` (or `undefined` if null).
- `onDayClick`: converts selected Date → YYYY-MM-DD string → calls `onSelect`. No-op if date is disabled.

### `usePublicAvailableDates` updated signature

```ts
function usePublicAvailableDates(
  tenantSlug: string,
  serviceId: string | null,
  locationId: string | null,
  staffId: string | null,
  startDate: string | null,    // YYYY-MM-DD — first visible day (max(today, first of month))
  endDate: string | null,      // YYYY-MM-DD — last day of shown month
  staffSelected: boolean,
): UseQueryResult<string[]>
```

The hook builds `?startDate=...&endDate=...` from the two params directly (no more internal `+6` calculation).

### `DateTimeSection` state change

```ts
// Before
const [windowStart, setWindowStart] = useState(0)

// After
const [month, setMonth] = useState<Date>(() => {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
})
```

`startDate` = max(today, first of `month`) formatted as YYYY-MM-DD.
`endDate` = last day of `month` formatted as YYYY-MM-DD.

Month navigation limits (computed once from today):
- `minMonth` = first day of current month
- `maxMonth` = first day of the month 3 months from now

### API cap

`MAX_WINDOW_DAYS` in `available-dates/route.ts`: `14` → `31`. No other logic changes — `generateAvailableDatesInWindow` already works for any window size.

## Rejected alternatives

**Keep `DateStrip` and always show 7 days (disabled for unavailable)**
Fixes the inconsistent page size but the strip metaphor still doesn't communicate monthly structure. Users have no sense of where in the month they are or how far ahead they're looking. Replaced by calendar for better UX with no extra backend work.

**Fetch availability in multiple chunks (2×14 days) to avoid raising the cap**
The 14-day cap was set when queries were expensive (O(days × staff × 4)). Since `generateAvailableDatesInWindow` now issues 4 queries regardless of window size, a 31-day window is equally cheap. Keeping the 14-day cap would require parallel fetching + merge logic on the client for no benefit.

**Custom calendar implementation**
shadcn's `Calendar` (built on `react-day-picker`) provides month navigation, keyboard accessibility, ARIA roles, and disabled date handling out of the box. Building custom would require significant effort for equal quality. Per ADR-009, shadcn components are the correct choice.

**Popup/modal date picker**
Adds an interaction step (click to open, click to close). Inline calendar is simpler and more scannable, especially on desktop where vertical space is not a constraint.

## Trade-offs accepted

- `react-day-picker` is added as a new runtime dependency. It is the peer dependency required by shadcn's Calendar and is well-maintained.
- The booking page grows slightly taller due to the calendar taking more vertical space than the strip. This is acceptable — the strip's compactness was a limitation, not a feature.
- `DateStrip` tests are deleted, not migrated. They tested implementation details specific to the strip (e.g. `flex-1` class, `windowStart` prop); the new `BookingCalendar` tests test equivalent user-visible behaviour.

## Out of scope

- Timezone-aware month boundaries (calendar always uses device local time for month rendering; slot times remain timezone-correct as before).
- Multi-month display.
- Week number display.
- Showing the number of available slots per day on the calendar.

## Edge cases

| Case | Handling |
|------|----------|
| Current month: today is not the 1st | `startDate` = today (not first of month); days before today in the current month are disabled via `date < today` matcher |
| All days in month unavailable | All days render disabled; user can navigate to next month |
| Month boundary navigation | `onMonthChange` triggers new `usePublicAvailableDates` fetch for the new month's window |
| Selected date becomes unavailable after navigation | Deselection is handled by `BookingWidget` reset — when month changes, `selectedDate` is cleared (same behaviour as current strip navigation) |
| Loading state on month change | `availableDates` returns to `null` while new fetch is in flight; skeleton shown |
| February / short months | Last day of month computed correctly with `new Date(year, month + 1, 0).getDate()` |
