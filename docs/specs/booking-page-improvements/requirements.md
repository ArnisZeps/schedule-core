# Requirements: booking-page-improvements

## User stories

- As a client, I want today's date to have a clear, unclipped highlight in the date strip, so I can easily identify the current day without visual artifacts.
- As a client, I want the date strip to show only days with available booking slots, so I don't waste time clicking dates that yield "no available times."
- As a client, I want the date strip dates to fill the full strip width evenly, so the UI looks polished with no trailing gap before the next-arrow.
- As a client, I want the service and staff lists to appear immediately on page load without a loading state or content jump, so the booking flow feels fast.

## Acceptance criteria

- [ ] Today's date ring/highlight renders without clipping — the border is fully visible on all sides
- [ ] The date strip hides days with zero available slots; if the full 7-day window has no slots, a "No available dates in this period" message is shown alongside the navigation arrows
- [ ] The 7 day buttons are distributed evenly across the full strip width with no trailing gap before the `>` arrow
- [ ] Services are present in the DOM on first paint (no client-side loading spinner for services)
- [ ] Staff list for the selected service appears without a separate network round-trip after service selection (single-location tenants)
- [ ] No visible height/content jump when the booking page loads
