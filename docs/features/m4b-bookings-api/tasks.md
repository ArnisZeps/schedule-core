# Tasks: m4b-bookings-api

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-02 Initial implementation

### Phase 0 — Setup
- [x] Verify `bookings` table and RLS policy are in place (M1 migration)

### Phase 1 — Tests first (present to user before implementing)
- [x] Integration test: GET /tenants/:id/bookings — list, date filter, resourceId filter, status filter
- [x] Integration test: POST /tenants/:id/bookings — happy path, overlap 409, outside-availability 409, 422
- [x] Integration test: PATCH /tenants/:id/bookings/:id — cancel, reschedule, already-cancelled 409
- [x] Integration test: GET /public/:slug/resources/:id/slots — returns correct free slots
- [x] Integration test: POST /public/:slug/bookings — happy path, overlap 409, outside-availability 409, rate-limit 429

### Phase 2 — Shared helpers
- [x] `apps/api/src/lib/availability.ts` — `checkOverlap(client, resourceId, start, end, excludeId?)`
- [x] `apps/api/src/lib/availability.ts` — `checkWithinAvailability(client, resourceId, start, end)`
- [x] `apps/api/src/lib/availability.ts` — `generateSlots(client, resourceId, date, durationMinutes)`

### Phase 3 — Owner routes
- [x] `apps/api/src/routes/bookings.ts` — GET list with filters
- [x] `apps/api/src/routes/bookings.ts` — POST create (manual)
- [x] `apps/api/src/routes/bookings.ts` — PATCH cancel / reschedule
- [x] Mount at `/tenants/:tenantId/bookings` in `apps/api/src/app.ts`

### Phase 4 — Public routes
- [x] `apps/api/src/routes/public.ts` — GET slots
- [x] `apps/api/src/routes/public.ts` — POST booking
- [x] Rate limiting middleware for public routes (per slug + IP)
- [x] Mount at `/public/:tenantSlug` in `apps/api/src/app.ts`

### Phase 5 — Verification
- [x] All integration tests green
- [x] `pnpm typecheck` passes
- [ ] Manual smoke test: create booking, check overlap rejection, generate slots
