# Tasks: Custom Time Dropdown

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-06-24 Initial implementation

- [x] Update `apps/web/src/test/reschedule-panel.test.tsx`: remove the text-input-specific custom-time tests; add `TimeSelect` dropdown tests (renders hour/minute selects, no free-text input, selecting time updates "Ends at", submit sends `override: true` with expected `startAt`/`endAt`). Present to user for approval before implementing.
- [x] In `NewAppointmentPanel.tsx`: replace the custom-time text `Input` with `<TimeSelect>` wired to `customStartTime`/`setCustomStartTime`; remove `handleCustomTimeChange`.
- [x] In `NewAppointmentPanel.tsx`: seed `customStartTime` on expand in `toggleCustomTime` (reschedule booking time → selected/prefill slot time → `'09:00'`, snapped to nearest 5-minute option); simplify `customTimeValid`.
- [x] Run the suite; confirm all custom-time tests pass.
- [x] Update `docs/domains/bookings.md`: change the `NewAppointmentPanel` custom-time description from `type="text"` `HH:MM` input to the `TimeSelect` two-dropdown picker.
