# Design: Booking Calendar Mobile Skeleton

## Problem

`BookingCalendar` renders an `absolute`-positioned skeleton overlay when `availableDates === null`. The overlay uses:
- `pt-10` (40px) to skip the month navigation header
- `flex-1 h-8` (32px fixed height) per skeleton cell

On mobile, the calendar has `w-full`, which causes actual day cells to expand via `aspect-square h-full w-full`. On a 390px screen the real cells become ~51px tall, while the skeleton cells stay at 32px. In addition, `pt-10` does not account for the weekday-label row beneath the month header (~76px total header height), so the skeleton grid also starts too high. The result is visibly misaligned and undersized skeleton cells.

## Solution

Replace the overlay approach with a **structural skeleton** — a dedicated `CalendarSkeleton` component that mirrors the DOM/flex structure of the real calendar. When `availableDates === null`, render `CalendarSkeleton` instead of the `Calendar` + overlay pair.

### Why structural works

The real calendar's day cells are `aspect-square flex-1` inside a `flex w-full` week row. A skeleton built the same way — `flex-1 aspect-square` `<Skeleton>` elements inside identical flex rows — will always match the real cells' geometry at every viewport width with no hard-coded pixel values.

### CalendarSkeleton structure

```
div.w-full.sm:w-fit.p-2                       (matches Calendar outer wrapper + padding)
  div.flex.items-center.justify-between.mb-4  (month navigation row)
    Skeleton.size-7.rounded-md                (prev button)
    Skeleton.h-4.w-24.rounded                 (month label)
    Skeleton.size-7.rounded-md                (next button)
  div.flex.gap-1.mb-2                         (weekday label row)
    7 × Skeleton.flex-1.h-3.rounded           (Su Mo Tu … Sa)
  6 × div.flex.gap-1.mt-2                     (week rows)
    7 × Skeleton.flex-1.aspect-square.rounded-md
```

`size-7` = 28px = `--cell-size`, matching the real calendar's nav button size.

### Rendering contract

`BookingCalendar` receives `availableDates: Set<string> | null`.
- When `null`: render `<CalendarSkeleton />` in place of `<Calendar>`.
- When non-null: render `<Calendar>` as today (no overlay needed, no fallback).

The outer `div.relative.w-full.sm:w-fit` wrapper is kept so the caller sees no layout change.

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/src/page-components/booking/BookingCalendar.tsx` | Add `CalendarSkeleton`; swap overlay pattern for structural replacement |

## Contracts

No API or data model changes. The `BookingCalendar` props interface is unchanged.

## Rejected alternatives

**Keep the overlay, fix `pt-X` and cell height** — requires hard-coded pixel values derived from internal Calendar class names (`--cell-size`, `gap-4`, text row heights). Any future calendar style change would re-introduce the bug silently. Rejected: fragile.

**Use a `ref` to measure the calendar and size the overlay dynamically** — adds runtime measurement complexity (ResizeObserver, layout effects) for a purely cosmetic concern. Rejected: over-engineered.

## Trade-offs accepted

`CalendarSkeleton` duplicates the calendar's flex/grid structure in a small amount of markup. This is intentional — it is the simplest way to guarantee geometry parity without coupling to Calendar internals.

## Out of scope

- Skeleton for `TimeSlotGrid` (separate component, not affected).
- Skeleton for `StaffSection` or `ServiceSection`.
- Any dark-mode or theme changes.

## Edge cases

- **5-row months** — the skeleton always renders 6 rows (matching the calendar's default maximum). A 5-row month will show one extra skeleton row momentarily; this is acceptable and avoids layout shift when the real calendar loads.
- **`sm:w-fit` breakpoint** — on desktop, `w-fit` constrains both the real calendar and the skeleton to their natural width. Cells use `min-w-(--cell-size)` in the real calendar; the skeleton `flex-1` cells compress to zero if unconstrained. The `sm:w-fit` wrapper prevents this on both.
