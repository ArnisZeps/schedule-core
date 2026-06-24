# Requirements: Custom Time Dropdown

## Problem

In the appointment panel (`NewAppointmentPanel`), the "Use custom time" section requires the operator to type the start time on the keyboard as a free-text `HH:MM` string. This is error-prone and inconsistent with the rest of the app: the staff schedule (`ScheduleWindowPanel`, `OverridePanel`) already uses a two-dropdown time picker (`TimeSelect`) for the same purpose.

The custom-time section is shared by both the **new appointment** and **reschedule** flows. The reported symptom is on reschedule ("calendar → reschedule appointment → use custom time"), but the same input serves both modes.

## User stories

- As a business owner rescheduling an appointment with a custom time, I want to pick the start time from hour and minute dropdowns instead of typing it, so that entry is fast and I cannot enter an invalid value.
- As a business owner creating a new appointment with a custom time, I want the same dropdown picker, so the experience matches the staff schedule editor.

## Acceptance criteria

### Custom time picker

- [ ] When the custom-time section is expanded (in either new or reschedule mode), the start time is selected via two dropdowns (hour `00`–`23`, minute in 5-minute steps `00`–`55`) — the same `TimeSelect` component used in the staff schedule.
- [ ] There is no free-text keyboard `HH:MM` input in the custom-time section.
- [ ] The dropdowns are pre-seeded with a sensible default when the section is expanded: the booking's existing start time (reschedule), the prefilled/selected slot time (new), or a fixed fallback when none exists — snapped to the nearest valid 5-minute option.
- [ ] The computed "Ends at HH:MM" line continues to display correctly (start + service `durationMinutes`).

### Submission

- [ ] Submitting with custom time active sends `override: true` in the POST (new) or PATCH (reschedule) body, unchanged from current behaviour.
- [ ] `startAt`/`endAt` are derived from the selected date + the picked time, unchanged from current behaviour.
- [ ] Because the dropdowns always yield a valid `HH:MM`, custom time is always submittable while active (the previous "disabled until a valid time is typed" state no longer applies).
- [ ] Toggling custom time off restores the slot grid (unchanged).

### Consistency / no regressions

- [ ] The change applies identically to new-appointment and reschedule modes (shared component).
- [ ] The Safari iOS overflow problem that motivated the original free-text input does not return — native `<select>` elements do not have the `input[type="time"]`/`type="date"` intrinsic-width overflow issue.
