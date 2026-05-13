# Tasks: m8a-schedule-calendar-fixes

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-13 Initial implementation

- [x] Create `TimeSelect` component (`apps/web/src/components/ui/TimeSelect.tsx`) with hour (00–23) and minute (00–55, step 5) selects; accepts/emits HH:MM string; integrates with react-hook-form via `Controller`
- [x] Replace `<input type="time">` with `<TimeSelect>` in `ScheduleWindowPanel` (start + end time fields)
- [x] Replace `<input type="time">` with `<TimeSelect>` in `OverridePanel` (start + end time fields)
- [x] Update `HOUR_PX` to 38 in `TimeGutter`, `WeekdayColumn`, `OverrideCalendar`, `OverrideBlock`; fix half-hour divider offset from hardcoded `+32` to `+HOUR_PX / 2` in `WeekdayColumn` and `OverrideCalendar`
- [x] Add `paddingTop: 8` to the inner content row of the scroll area in `WeeklyScheduleCalendar` and `OverrideCalendar`
- [x] Fix `overridesForDay` in `OverrideCalendar` to use range check (`startDate <= dateIso && dateIso <= endDate`) instead of equality
- [x] Update `docs/domains/staff.md` to reflect the `TimeSelect` component addition
