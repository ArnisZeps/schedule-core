# Design: m8b-override-continuous-range

## Problem

The current override model applies `startTime–endTime` as a repeated window on each individual day in `[startDate, endDate]`. A `not_available` override for May 11–14 at 18:00–19:30 therefore blocks only 18:00–19:30 on each of those four days, leaving the rest of each day open. This is wrong for the primary use case: vacation, sick leave, or any continuous absence. The intended semantic is a single uninterrupted block: unavailable from May 11 18:00 straight through to May 14 19:30.

No schema change is needed. The data model already stores `start_date`, `end_date`, `start_time`, `end_time` — they just need to be interpreted as the endpoints of a continuous range rather than a per-day window.

## Components

| File | Change |
|------|--------|
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/overrides/route.ts` | Relax `startTime < endTime` validation: only enforce when `startDate === endDate` |
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/overrides/[overrideId]/route.ts` | Same validation relaxation |
| `apps/web/src/lib/server/availability.ts` | Add `clipOverrideWindow` helper; update `generateStaffSlots` to select `start_date`/`end_date` from override rows and apply clipping before passing to `slotsForWindows` |
| `apps/web/src/components/staff/OverrideCalendar.tsx` | `overridesForDay` uses range check; computes a `position` ('start' \| 'middle' \| 'end' \| 'single') for each override and passes it to `OverrideBlock` |
| `apps/web/src/components/staff/OverrideBlock.tsx` | Accepts `position` prop; derives `top` and `height` from position + override times instead of always using `startTime–endTime` |

## Contracts

### `clipOverrideWindow(override, date) → { start_time, end_time }`

Pure function. Given an override row (with `start_date`, `end_date`, `start_time`, `end_time`) and a query date string:

| Condition | Returns |
|-----------|---------|
| `startDate === endDate` | `{ startTime, endTime }` — unchanged |
| `date === startDate` | `{ startTime, '24:00' }` |
| `startDate < date < endDate` | `{ '00:00', '24:00' }` |
| `date === endDate` | `{ '00:00', endTime }` |

`'24:00'` resolves to 1440 minutes, which is compatible with the existing `slotsForWindows` arithmetic.

### `OverrideBlock` — `position` prop

```ts
type OverridePosition = 'single' | 'start' | 'middle' | 'end'
```

| Position | `top` | `height` |
|----------|-------|----------|
| `single` | `timeToMinutes(startTime) / 60 * HOUR_PX` | `(endMin - startMin) / 60 * HOUR_PX` |
| `start` | `timeToMinutes(startTime) / 60 * HOUR_PX` | `TOTAL_HEIGHT - top` |
| `middle` | `0` | `TOTAL_HEIGHT` |
| `end` | `0` | `timeToMinutes(endTime) / 60 * HOUR_PX` |

### API validation change

`overrideBodySchema` refinement `.refine(d => d.startTime < d.endTime)` is gated on `d.startDate === d.endDate`. For multi-day overrides the constraint is dropped — any `startTime`/`endTime` combination is valid.

No request/response shape change. No new API endpoints.

## Rejected alternatives

- **Remove `startTime`/`endTime` for multi-day (Option 2)**: inflexible — owners need to model partial-day departures and returns.
- **Store as a single datetime range (`start_at`, `end_at`)**: requires a schema migration and breaks the existing API contract. The current per-field model is sufficient with correct interpretation.
- **Add a `continuous` boolean flag**: unnecessary indirection. Any override with `startDate < endDate` is always treated as continuous; there is no use case for per-day windowing across multiple days.

## Trade-offs accepted

- `'24:00'` is used as a sentinel for "end of day" in `clipOverrideWindow`. This is not a valid `HH:MM` clock value but is handled correctly by the existing integer arithmetic in `slotsForWindows`. If the time parsing is ever changed to use `Date` objects this sentinel must be revisited.
- The calendar renders separate blocks per column (not a visually connected spanning widget). This is acceptable for MVP — the position-aware heights make the continuous range visually clear.

## Out of scope

- Connecting the per-column blocks with a visual bridge or shared header bar.
- Validating that a `not_available` multi-day override does not fully shadow an `available` override (left to the owner to manage).
- Timezone-aware midnight handling for overrides that cross a DST boundary.

## Edge cases

- **Override starts before the visible week**: `overridesForDay` range check picks it up for intermediate and end days within the week. `position` is `'middle'` or `'end'` accordingly — no `'start'` block is shown in this week view.
- **Override ends after the visible week**: similar — start and middle days show; no `'end'` block this week.
- **Single-day override (`startDate === endDate`)**: `position = 'single'`, exact `startTime–endTime` block. Unchanged from current behavior.
- **`startTime > endTime` on multi-day** (e.g. Mon 22:00 → Tue 06:00): valid continuous overnight block. `clipOverrideWindow` on Mon returns `{ '22:00', '24:00' }`, on Tue returns `{ '00:00', '06:00' }`.
- **`available` type**: same `clipOverrideWindow` logic applied to the add-overrides list in `generateStaffSlots`. Full days become fully available windows.
