# Requirements: m8b-override-continuous-range

## User stories

- As a business owner, I want a multi-day override to block all time from its start datetime to its end datetime as one continuous period, so that I can model vacation and sick leave correctly without clients booking into the middle days.
- As a business owner, I want to set a start time on the first day (e.g. "leaving at noon on Monday") and an end time on the last day (e.g. "back by 17:00 on Friday"), so that work before departure and after return remains bookable.
- As a business owner, I want the calendar to show each day's actual blocked portion rather than identical repeated blocks, so that I can see exactly when I'm unavailable across the week.

## Acceptance criteria

- [ ] A `not_available` override with `startDate < endDate` blocks all slots from `startDate + startTime` through `endDate + endTime` as a continuous range. Slots before `startTime` on `startDate` and after `endTime` on `endDate` remain available.
- [ ] Intermediate days (between `startDate` and `endDate`) are fully blocked — no slots generated.
- [ ] An `available` override with `startDate < endDate` adds availability windows using the same continuous logic: `startTime–24:00` on the first day, full day on intermediate days, `00:00–endTime` on the last day.
- [ ] Single-day overrides (`startDate === endDate`) are unchanged — `startTime–endTime` applies exactly as before.
- [ ] The API accepts multi-day overrides where `startTime >= endTime` (valid for e.g. Mon 22:00 → Tue 06:00). The `startTime < endTime` constraint is only enforced for single-day overrides.
- [ ] The calendar renders each day's block at the correct height: start-day block runs from `startTime` to the bottom of the column; intermediate-day blocks fill the full column height; end-day block runs from the top of the column to `endTime`.
