# Tasks: New Appointment Time Input Mobile

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-24 Initial implementation

- [x] In `NewAppointmentPanel.tsx` change the custom time `Input`: `type="time"` → `type="text"`, add `placeholder="HH:MM"`
- [x] Verify existing tests still pass (no test changes expected)
- [x] Update `docs/domains/bookings.md` — note custom time input uses `type="text"` with `placeholder="HH:MM"`

## 2026-05-24 Input formatting and validation

- [x] Add `handleCustomTimeChange` to `NewAppointmentPanel`: strip non-digits, limit to 4 digits, auto-insert colon after 2nd digit, validate hours ≤ 23 and minutes ≤ 59 (clear on invalid)
- [x] Wire `handleCustomTimeChange` to the custom time `Input`
- [x] Add RTL tests: strips non-digits, auto-formats HH:MM, limits to 4 digits, clears on invalid hours, clears on invalid minutes

## 2026-05-24 Date input Safari fix

- [x] Make `NewAppointmentPanel` full-width on mobile: `w-96 border-l` → `w-full md:w-96 md:border-l` on the slide-over container
- [x] Wrap the date `Input` in `NewAppointmentPanel` with `<div className="overflow-hidden">` — clips Safari iOS's intrinsic minimum width on `input[type="date"]` which `w-full` alone cannot override
- [x] Update `docs/domains/bookings.md` — note `className="flex"` on the date input and full-width mobile panel
