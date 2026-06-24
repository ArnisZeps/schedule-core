# Design: Custom Time Dropdown

## Problem

The custom-time section of `NewAppointmentPanel` uses a free-text `Input` (`type="text"`, `placeholder="HH:MM"`) with a `handleCustomTimeChange` handler that strips non-digits, auto-inserts a colon, and validates ranges. The operator types the time on the keyboard.

The staff schedule already solves the same problem with `TimeSelect` — two native `<select>` dropdowns (hour `00`–`23`, minute `00`–`55` in 5-minute steps) that emit an `HH:MM` string. Reuse it here.

`TimeSelect`'s output contract (`HH:MM` string) is identical to the current `customStartTime` state value, so all downstream logic — `buildCustomSlot`, `computeCustomEndTime`, the `override: true` submission path — is unchanged.

## Solution

In `NewAppointmentPanel.tsx`:

1. Replace the custom-time `Input` (the `data-testid="custom-time-input"` block) with `<TimeSelect>`, wired to `customStartTime` / `setCustomStartTime`.
2. Delete `handleCustomTimeChange` — `TimeSelect` always emits a valid `HH:MM`, so digit-stripping/range-validation is no longer needed.
3. Seed `customStartTime` with a sensible default when the section is expanded, instead of starting empty (see below).
4. Simplify the submit-disabled logic: `customTimeValid` is always true while custom time is active (a value is always present). Keep the `customStartTime.length === 5` guard as a defensive check but it will always pass once seeded.

No changes to API routes, hooks, or the data model. No changes to the slot-grid path, override checkbox, or any other field.

### Seeding the default time

Currently toggling custom time on sets `customStartTime = ''`. With a free-text input an empty field is fine. With `TimeSelect` an empty value renders as `00:00` visually while state is `''` — misleading (looks valid, but submit would be blocked). So seed a real value on expand:

`toggleCustomTime` (when turning **on**) sets `customStartTime` to the first available of:
1. Reschedule mode: the local time portion of `rescheduleBooking.startAt`.
2. New mode: the local time portion of `selectedSlot.startAt` or `prefillStart`, if present.
3. Fallback: `'09:00'`.

The seed is snapped down to the nearest valid 5-minute option so it maps to a real `<select>` value. `TimeSelect` already coerces an off-grid minute to `00` on render, but seeding on-grid keeps the displayed and stored value consistent.

## Components

| File | Change |
|------|--------|
| `apps/web/src/components/calendar/NewAppointmentPanel.tsx` | Import `TimeSelect`. Replace the custom-time text `Input` with `<TimeSelect id="custom-time" value={customStartTime} onChange={setCustomStartTime} />`. Remove `handleCustomTimeChange`. Seed `customStartTime` on expand in `toggleCustomTime`. Add a `snapToFiveMin` / time-portion helper as needed. |
| `apps/web/src/components/ui/TimeSelect.tsx` | No change — reused as-is. |

## Contracts

No API, hook, or data-model changes. `customStartTime` remains an `HH:MM` string. `buildCustomSlot` and `computeCustomEndTime` are untouched.

## Test impact

`apps/web/src/test/reschedule-panel.test.tsx` — the custom-time tests must be updated:

- **Remove / replace** (text-input specific, no longer apply):
  - `custom time input is type text ...`
  - `custom time input has placeholder HH:MM`
  - `strips non-digits ...`
  - `auto-formats 4 digits to HH:MM`
  - `limits to 4 digits`
  - `clears on invalid hours`
  - `clears on invalid minutes`
  - `submit button is disabled when custom time active but no time entered` (no longer reachable — a value is always seeded)
- **Add** (dropdown behaviour, using `data-testid="time-hour-select"` / `time-min-select` from `TimeSelect`):
  - Expanding custom time renders the hour and minute dropdowns (and no free-text input).
  - Selecting hour/minute updates the computed "Ends at" line.
  - Submitting with a dropdown-selected custom time sends `override: true` and the expected `startAt`/`endAt` (port the existing `'14:00'` POST-body assertion to dropdown selection).
- **Keep** (mode-agnostic, still valid):
  - `custom time section is collapsed by default showing toggle text`
  - `expanding custom time hides the slot grid`
  - `toggling custom time off restores the slot grid`
  - `custom time section also appears in reschedule mode`

Per TDD: present the updated tests for approval before implementing.

## Relationship to prior specs

- `_archive`-bound `new-appointment-time-input-mobile` changed `type="time"` → `type="text"` specifically to dodge Safari iOS's native time-picker intrinsic-width overflow. `TimeSelect` uses native `<select>` elements, which do **not** exhibit that overflow, so this change supersedes that workaround for the start-time field without reintroducing the bug. No ADR conflict.
- `reschedule-panel` introduced the custom-time section. This spec only swaps its input control.

## Rejected alternatives

- **Keep the free-text input** — it is the reported problem; inconsistent with staff schedule.
- **`<input type="time">`** — reintroduces the Safari iOS overflow that `new-appointment-time-input-mobile` fixed.
- **New per-minute (60-option) dropdown** — the request anchors on "like staff → schedule", which is 5-minute steps. Reusing `TimeSelect` unchanged is less code and keeps the app consistent. See trade-off below.

## Trade-offs accepted

- **5-minute minute granularity.** The free-text input accepted any minute (e.g. `18:54`); `TimeSelect` offers 5-minute steps only. This matches the staff schedule and the slot grid's coarse granularity and is acceptable for owner-entered appointments. If sub-5-minute custom times are later required, `TimeSelect`'s `MINUTES` array is the single place to change.

## Out of scope

- Changes to the public booking widget.
- Changes to the slot-grid time selection.
- Changes to `TimeSelect` itself (granularity, styling).
- The date input (already handled by `new-appointment-time-input-mobile`).
