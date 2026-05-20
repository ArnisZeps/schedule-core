# Requirements: calendar-prefetch

## User stories

- As a business owner viewing the appointment calendar, I want navigating to the previous or next week/day to feel instant, so that I can browse the schedule without waiting for data to load.

## Acceptance criteria

- [ ] Clicking prev/next week shows bookings immediately with no loading state (warm cache)
- [ ] Clicking prev/next day shows bookings immediately with no loading state (warm cache)
- [ ] First navigation after a cold page load still fetches normally (cache miss is acceptable)
- [ ] Prefetch does not fire for ranges already in cache and within staleTime
- [ ] Prefetch does not block or delay rendering of the current view
- [ ] Existing tests remain green
