# Requirements: m4b-bookings-api

## User stories

- As a business owner, I want to see all upcoming bookings so that I can manage my schedule.
- As a business owner, I want to filter bookings by date range so that I can focus on a specific period.
- As a business owner, I want to filter bookings by resource so that I can see one staff member's schedule.
- As a business owner, I want to cancel a booking so that I can free the slot when a client cancels.
- As a business owner, I want to reschedule a booking so that I can move an appointment without losing the client record.
- As a business owner, I want to manually create a booking so that I can log phone or walk-in appointments.
- As a client, I want to book an available slot without creating an account so that I can self-serve quickly.
- As a client, I want to see available time slots for a resource on a given date so that I can pick a convenient time.

## Acceptance criteria

### List
- [ ] `GET /tenants/:tenantId/bookings` returns all bookings for the tenant.
- [ ] Supports `?from=ISO8601&to=ISO8601` query params to filter by date range (inclusive).
- [ ] Supports `?resourceId=UUID` to filter to a single resource.
- [ ] Returns bookings sorted by `start_at` ascending.
- [ ] Cancelled bookings are included unless `?status=active` is passed.
- [ ] Returns 400 if `from` or `to` is not a valid ISO 8601 timestamp.
- [ ] Returns 403 if the JWT tenant does not match `:tenantId`.

### Create (manual entry)
- [ ] `POST /tenants/:tenantId/bookings` creates a booking with status `pending`.
- [ ] Requires `resourceId`, `clientName`, `clientEmail`, `startAt`, `endAt`.
- [ ] Returns 409 if the slot overlaps an existing non-cancelled booking for the same resource.
- [ ] Returns 409 if the slot falls outside the resource's availability rules.
- [ ] Returns 422 on validation errors (missing fields, `startAt >= endAt`).

### Cancel
- [ ] `PATCH /tenants/:tenantId/bookings/:id` with `{ "status": "cancelled" }` sets status to `cancelled`.
- [ ] Returns 409 if the booking is already cancelled.
- [ ] Returns 404 if the booking does not belong to the tenant.

### Reschedule
- [ ] `PATCH /tenants/:tenantId/bookings/:id` with `{ "startAt", "endAt" }` moves the booking.
- [ ] Overlap check runs on the new slot, excluding the booking being rescheduled.
- [ ] Availability rule check runs on the new slot.
- [ ] Returns 409 on overlap or outside-availability conflict.

### Public booking
- [ ] `POST /public/:tenantSlug/bookings` creates a booking without JWT auth.
- [ ] Returns 404 if the tenant slug does not exist.
- [ ] Overlap and availability checks run identically to the owner-side create.
- [ ] Rate-limited per tenant slug + IP (429 on breach).
- [ ] `GET /public/:tenantSlug/resources/:resourceId/slots?date=YYYY-MM-DD&duration=minutes` returns available slots.
- [ ] Slots exclude times already booked (non-cancelled) and times outside availability rules.

### Quality
- [ ] Owner routes require JWT auth (existing middleware).
- [ ] Owner queries run inside `withTenantContext` (RLS enforced).
- [ ] Public routes resolve tenant by slug; no RLS context needed.
- [ ] Integration tests cover happy path + overlap + outside-availability for create, reschedule, and public booking.
- [ ] `pnpm typecheck` passes with zero errors.
