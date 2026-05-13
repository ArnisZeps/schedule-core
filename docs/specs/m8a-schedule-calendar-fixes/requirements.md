# Requirements: m8a-schedule-calendar-fixes

## User stories

- As a business owner configuring staff schedules, I want time inputs to display in 24-hour format, so that I don't have to deal with AM/PM ambiguity.
- As a business owner, I want the schedule calendar to be more compact, so that I can see more of the day at once without scrolling.
- As a business owner, I want the 00:00 row to be fully visible at the top of the calendar, so that midnight-starting schedules are not obscured.
- As a business owner, I want multi-day overrides to appear on every day they cover in the calendar, so that I can see the full span of an override at a glance.

## Acceptance criteria

- [ ] Time inputs in `ScheduleWindowPanel` and `OverridePanel` render in 24-hour format (00–23 hours) regardless of the user's OS locale.
- [ ] The calendar grid is 40% vertically tighter than current (`HOUR_PX` reduced from 64 to 38).
- [ ] The `00:00` label in `TimeGutter` is fully visible and not clipped when the calendar is scrolled to the top.
- [ ] A schedule override with `startDate < endDate` renders a coloured block on every day within the `[startDate, endDate]` range that falls in the current week view.
- [ ] All existing calendar interactions (drag-to-create, block click, ghost preview) continue to work correctly after the density change.
