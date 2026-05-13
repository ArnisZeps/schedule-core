# Design: m8a-schedule-calendar-fixes

## Problem

Four independent bugs in the staff schedule management UI:

1. **AM/PM time inputs** — `<input type="time">` renders in the OS locale's clock format. On systems configured for 12-hour time (most macOS/Windows locales), it shows AM/PM spinners instead of 24-hour numbers. The backend and all internal data use `HH:MM` 24-hour strings, so this causes friction for owners entering times.

2. **Calendar density** — Each hour row is 64 px tall, making the grid occupy ~1536 px for a full day. The viewport clips to 400 px, leaving a lot of scrolling for a typical working-hours view. 40% reduction (→ 38 px/hour) keeps the grid readable while compressing the scroll range.

3. **00:00 clipped at top** — `TimeGutter` positions each label at `top: i * HOUR_PX - 7`, centering it on the hour gridline. For `i = 0` this is `top: -7px`. The label sits inside an `overflow-y-auto` scroll container, so negative Y is clipped: 00:00 is never visible. Adding `paddingTop: 8` to the inner content row of the scroll container gives the first label the clearance it needs.

4. **Multi-day overrides single-column** — `overridesForDay` filters on `o.startDate === dateIso`, so an override spanning Mon–Wed only renders a block in Monday's column. The fix is a range check: `o.startDate <= dateIso && dateIso <= o.endDate`.

## Components

| File | Change |
|------|--------|
| `apps/web/src/components/ui/TimeSelect.tsx` | New component: two `<select>` elements (hour 00–23, minute 00/05/10/…/55). Props: `value: string` (HH:MM), `onChange: (v: string) => void`, `id?: string`, `className?: string`. Integrates with react-hook-form via `Controller`. |
| `apps/web/src/components/staff/ScheduleWindowPanel.tsx` | Replace `<input type="time">` for start/end with `<TimeSelect>` via `Controller`. |
| `apps/web/src/components/staff/OverridePanel.tsx` | Same replacement as above. |
| `apps/web/src/components/calendar/TimeGutter.tsx` | `HOUR_PX` 64 → 38. |
| `apps/web/src/components/staff/WeekdayColumn.tsx` | `HOUR_PX` 64 → 38. Half-hour divider `top: i * HOUR_PX + 32` → `top: i * HOUR_PX + HOUR_PX / 2`. |
| `apps/web/src/components/staff/OverrideCalendar.tsx` | `HOUR_PX` 64 → 38. Half-hour divider same fix. `overridesForDay` range check. Add `paddingTop: 8` to scroll area inner content div. |
| `apps/web/src/components/staff/OverrideBlock.tsx` | `HOUR_PX` 64 → 38. |
| `apps/web/src/components/staff/WeeklyScheduleCalendar.tsx` | Add `paddingTop: 8` to scroll area inner content div. |

## Contracts

No API changes. No data model changes. `TimeSelect` outputs and accepts `HH:MM` strings — fully compatible with existing form schemas and backend endpoints.

## Rejected alternatives

- **Force 24h via `lang="en-GB"` on the `<input type="time">`** — browser-specific hack; not guaranteed by any spec; fails on some Chromium versions and all Safari builds where the locale attribute is ignored for time inputs.
- **Text input with `pattern="[0-2][0-9]:[0-5][0-9]"`** — allows free-text entry prone to typos; no picker UX; worse on mobile.
- **Extract `HOUR_PX` to a shared constant file** — adds indirection for a trivial change; each calendar component is self-contained by design. Keeping the constant local is consistent with existing conventions.
- **Padding in `TimeGutter` itself** — would leave the gutter height out of sync with the grid column heights (both must agree on total height = `HOUR_PX * 24`). Padding must go on the shared wrapper row, not inside the gutter.

## Trade-offs accepted

- Minutes in `TimeSelect` step by 5 (00, 05, 10 … 55). This is coarser than the free-text `<input type="time">` but finer than the calendar's 15-minute drag snap. It covers all practical schedule entry scenarios without clutter.
- `HOUR_PX = 38` means the half-hour divider lands at `19 px`. Block heights for very short windows (< 15 min) may become hard to click, but 15 min is the minimum unit enforced by the drag snap, so this is not a regression.

## Out of scope

- Changing the 15-minute drag-snap granularity.
- Making the calendar height configurable.
- Timezone display or conversion in the calendar grid.

## Edge cases

- **Override spans entire week**: `overridesForDay` range check renders it in all 7 columns — correct behaviour.
- **Override spans into/out of the displayed week**: only days within `days[]` (the current week) render blocks — correct, no column exists for out-of-range dates.
- **`TimeSelect` receives empty string** (initial form state): both selects show their first option (00 / 00) without error. The form schema requires a non-empty value so submission is blocked until the user picks a meaningful time.
- **Existing `HH:MM` prefill values** (from drag-to-select): `TimeSelect` parses the prefill string and selects the correct hour/minute on mount.
