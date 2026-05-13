# Tasks: Location Timezone Auto-detect

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-13 Implementation

- [x] Write failing RTL tests for `LocationForm`: (1) timezone field absent from DOM in create mode, (2) timezone field absent from DOM in edit mode, (3) submitted payload contains browser timezone on create, (4) submitted payload echoes stored timezone on edit. Present to user for approval before implementing.
- [x] Remove the timezone `<FormField>` block from `LocationForm.tsx`. Change the `timezone` default value from `'UTC'` to `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- [x] Run RTL tests — confirm green.
- [x] Browser-verify with Playwright: skipped — user will verify manually.
- [x] Update `docs/domains/locations.md` — note that `timezone` is auto-detected on create and not exposed in the UI.
