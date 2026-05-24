# Design: New Appointment Time Input Mobile

## Problem

On Safari iOS (iPhone 16), the `<input type="time">` in `NewAppointmentPanel`'s custom time section overflows its containing border box to the right. It renders correctly in Chromium device emulation.

**Why it happens:**

The `NewAppointmentPanel` is `w-96` (384px), positioned `absolute right-0` — essentially full-screen on a 390px iPhone. After body padding (`p-4` = 32px) and the custom time container padding (`p-3` = 24px), the input's available width is ~328px.

Safari iOS renders `input[type="time"]` using the browser's native segmented time picker via the `-webkit-date-and-time-value` pseudo-element. This internal layout:
- Has a fixed minimum intrinsic width (~360px or more) that ignores CSS `width: 100%` and `min-w-0`
- Does not respect the `h-8` (32px) height constraint from `Input` — when height is too short to render vertically, the picker overflows horizontally instead

This is a Safari WebKit behaviour, not a CSS precedence issue. Adding `overflow-hidden` to the container or adjusting padding would be a workaround that may re-emerge with different viewport sizes.

## Solution

Replace `type="time"` with `type="text"` at the call site in `NewAppointmentPanel`.

This is appropriate because:
- `NewAppointmentPanel` is a **staff-facing** dashboard feature. Operators entering a custom time know the `HH:MM` format.
- The existing validation (`customStartTime.length === 5`) and parsing (`buildCustomSlot`, `computeCustomEndTime`) already operate on plain `HH:MM` strings — no changes needed there.
- The `Input` component with `type="text"` is well-behaved on Safari iOS at any container width.
- No browser-specific CSS, pseudo-element targeting, or platform detection is required.

**Change:**

In `NewAppointmentPanel.tsx`, the custom time `Input`:
- `type="time"` → `type="text"`
- Add `placeholder="HH:MM"` to guide the format
- Remove nothing else — all validation, state, and submission logic is unchanged

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/src/components/calendar/NewAppointmentPanel.tsx` | Change `type="time"` → `type="text"` + add `placeholder="HH:MM"` on the custom time input (line ~462) |

## Contracts

No API, data model, or hook changes. The `customStartTime` state value format (`HH:MM`) is unchanged.

## Rejected alternatives

**`overflow-hidden` on the container** — clips the overflowing input visually without fixing the layout. Would not solve the problem if viewport width changes. Workaround, not a fix.

**Target `-webkit-date-and-time-value` pseudo-element** — browser-internal pseudo-elements are not part of any standard, their behaviour changes across Safari versions, and they cannot be reliably tested in jsdom/RTL. Brittle.

**Increase container/panel width on mobile** — the panel is already nearly full-screen. Adding width would push content off-screen. The panel layout is not the root cause.

**Native time picker via `type="time"`** — provides a wheel picker on iOS but at the cost of a broken layout. For a staff dashboard (not a public form), operator familiarity with `HH:MM` is a safe assumption.

## Trade-offs accepted

Staff on mobile must type `HH:MM` manually (e.g. `18:54`) rather than using a native wheel picker. This is acceptable for a dashboard feature used by experienced operators.

## Out of scope

- Changes to the public booking widget's time entry.
- Changes to the `Input` component itself.
- Any other form fields in `NewAppointmentPanel`.

## Edge cases

- **Partial input** (`customStartTime.length !== 5`): submit button stays disabled; `computeCustomEndTime` returns `''`; "Ends at" line is hidden. Behaviour unchanged.
- **Invalid characters** (e.g. `aa:bb`): `buildCustomSlot` returns `null`; `handleSubmit` shows "Please enter a valid time". Behaviour unchanged.
