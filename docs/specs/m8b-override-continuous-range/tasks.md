# Tasks: m8b-override-continuous-range

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-13 Initial implementation

- [x] Relax `startTime < endTime` validation in both override route files to only enforce when `startDate === endDate`
- [x] Add `clipOverrideWindow` helper to `availability.ts`; update `generateStaffSlots` to select `start_date`/`end_date` in both override queries and apply clipping before passing to `slotsForWindows`
- [x] Update `OverrideCalendar.tsx`: `overridesForDay` range-check filter; compute `position` ('single' | 'start' | 'middle' | 'end') per override per day; pass to `OverrideBlock`
- [x] Update `OverrideBlock.tsx` to derive `top`/`height` from `position` prop
- [x] Update `docs/domains/staff.md` to document continuous-range override semantics
