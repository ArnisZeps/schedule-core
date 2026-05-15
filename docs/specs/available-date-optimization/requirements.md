# Requirements: Available Date Optimization

## User stories

- As a client on the booking page, I want the date strip to load in under 500ms, so that I can select an appointment date without waiting.
- As a business owner, I want the booking widget to feel fast for my clients even as my staff roster grows, so that load time does not degrade with additional staff members.

## Acceptance criteria

- [ ] `GET /api/public/:tenantSlug/services/:serviceId/available-dates` responds in under 500ms for a 7-day window with up to 5 staff members (measured against a warm Neon connection).
- [ ] The total number of DB queries issued by `available-dates` is constant regardless of window size — 4 queries maximum (tenant lookup, service lookup, location lookup, batch data fetch), not O(days × staff).
- [ ] The response body (list of available date strings) is identical to the current implementation for all valid inputs.
- [ ] The existing `GET /api/public/:tenantSlug/services/:serviceId/slots` endpoint is unaffected — no change to its behavior or DB query count.
- [ ] All existing tests for `availability.ts` and `available-dates` continue to pass.
- [ ] New unit tests for `generateAvailableDatesInWindow` cover: no staff, no schedule, add/block overrides, existing bookings filling all slots, and timezone boundary dates.
