# Tasks — fix/schedule-update

- [x] 1. Update `handlePanelUpdate` and `handlePanelDelete` in `WeeklyScheduleCalendar` to look up the target window from `panelState.window` by content (`dayOfWeek + startTime + endTime`); replace silent `return` with error toast — `apps/web/src/components/staff/WeeklyScheduleCalendar.tsx`
- [x] 2. Simplify `ScheduleWindowPanel` `onUpdate`/`onDelete` props — remove `key` parameter — `apps/web/src/components/staff/ScheduleWindowPanel.tsx`
- [x] 3. Write tests per `docs/guidelines/testing.md` and present for approval before implementing
- [x] 4. Update `docs/domains/staff.md` — note that schedule window lookup uses the `(dayOfWeek, startTime, endTime)` snapshot from `panelState.window`
