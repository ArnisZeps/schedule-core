# Requirements: Booking Calendar Picker

## User stories

- As a client on the booking page, I want to see a full month calendar when selecting a date, so that I understand which days are available without having to page through 7-day strips.
- As a client, I want unavailable days to be visible but greyed out, so that I can see the shape of the schedule and understand why certain days cannot be booked.
- As a client, I want to navigate month by month, so that I can look ahead to find a convenient date.

## Acceptance criteria

- [ ] The date strip (`DateStrip`) is removed and replaced by a month calendar grid.
- [ ] The calendar shows all days in the current month. Days with at least one available slot are selectable; days without slots are visible but disabled (greyed out, not clickable).
- [ ] Past dates (before today) are always disabled.
- [ ] Month navigation: back arrow disabled when on the current month; forward arrow disabled 3 months from today.
- [ ] While available-dates are loading, the calendar shows a skeleton overlay (days not yet interactable).
- [ ] Clicking an available date selects it and triggers the time slot grid below, identical to the current behaviour.
- [ ] The `available-dates` API window cap is raised from 14 to 31 days to support full-month fetches.
- [ ] All existing tests for `DateStrip` are removed and replaced by equivalent `BookingCalendar` RTL tests. The full booking flow end-to-end test is updated to work with the calendar.
- [ ] No regression in the `TimeSlotGrid`, `DetailsSection`, or booking submission flow.
