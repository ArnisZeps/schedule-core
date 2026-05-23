# Requirements: fix-ssr-bookings-week

## User stories

- As a business owner, I want appointments to always appear on the calendar when I navigate to a specific week, so that I can trust the calendar shows correct data.
- As a business owner, I want the URL to clearly show the date range I am viewing for a week view, so I can bookmark or share a specific week.

## Acceptance criteria

- [ ] Week view URL shows explicit `?from=YYYY-MM-DD&to=YYYY-MM-DD` params (Monday–Sunday of the displayed week)
- [ ] Navigating directly to `/appointments?view=week&from=2026-05-25&to=2026-05-31` renders all bookings for that week without requiring a page interaction or wait
- [ ] Refreshing the page on any week preserves the correct bookings
- [ ] Prev/Next/Today toolbar navigation updates `from`/`to` in the URL correctly
- [ ] Day view URL is unchanged (`?view=day&date=YYYY-MM-DD`)
- [ ] The disappearing-appointments bug is not reproducible
- [ ] Existing tests pass (updated to use `from`/`to` URL format where they check week-view navigation)
