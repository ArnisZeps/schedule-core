# Tasks: m7-booking-web-widget

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-11 Initial implementation

### Phase 0 — Rate limiting (DEFERRED — required before production launch, not before implementation)
<!-- No Redis infrastructure available. Must be resolved before going live. See ADR-011. -->
- [ ] DEFERRED: Add `@upstash/ratelimit` and `@upstash/redis` to `apps/web/package.json`
- [ ] DEFERRED: Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env.local` and document in `.env.example`
- [ ] DEFERRED: Replace the removed in-memory rate limiter in `apps/web/app/api/public/[tenantSlug]/bookings/route.ts` with Upstash sliding window (10 req / 60 s per IP)

### Phase 1 — Tests first (present to user for approval before implementing)
- [x] Integration test: `GET /public/:tenantSlug/locations` — active only, 404 on unknown slug
- [x] Integration test: `GET /public/:tenantSlug/services` — all services, 404 on unknown slug
- [x] Integration test: `GET /public/:tenantSlug/services/:serviceId/staff?locationId` — qualified active staff; 422 missing locationId; 404 unknown slug/service
- [x] Integration test: `GET /public/:tenantSlug/services/:serviceId/slots` — extended: locationId required, staffId optional (specific staff path vs any-available path); missing locationId → 400
- [x] Integration test: `POST /public/:tenantSlug/bookings` — extended: locationId + staffId + clientPhone; 409 overlap; 409 no staff available; 422 missing phone; 429 rate limit
- [x] RTL test: `ServiceSection` — renders service cards; clicking selects; selected card highlighted
- [x] RTL test: `StaffSection` — "Any available" always first; staff cards rendered; clicking selects; shows placeholder when no service prop
- [x] RTL test: `DateStrip` — shows 7 days; prev/next navigation shifts window; clicking a day fires onSelect
- [x] RTL test: `TimeSlotGrid` — renders slot buttons; unavailable slots disabled; empty state when no slots; loading skeleton shown
- [x] RTL test: `DetailsSection` — form validation: empty name blocks submit; phone < 7 chars blocks submit; invalid email blocks submit; valid data enables submit
- [x] RTL test: `BookingWidget` (full flow, MSW) — single-location happy path end to end; shows confirmation on success
- [x] RTL test: `BookingWidget` — 409 on submit clears selected slot and shows error message
- [x] RTL test: `FloatingNav` — renders correct number of pills; clicking each calls scrollIntoView

### Phase 2 — New public API endpoints
- [x] `GET /public/:tenantSlug/locations` route handler
- [x] `GET /public/:tenantSlug/services` route handler
- [x] `GET /public/:tenantSlug/services/[serviceId]/staff` route handler (requires `locationId` query param)
- [x] Extend `GET /public/:tenantSlug/services/[serviceId]/slots` — add `locationId` (required) and `staffId` (optional); make `duration` optional (fallback to `duration_minutes`)
- [x] Extend `POST /public/:tenantSlug/bookings` — add `locationId`, `staffId`, `clientPhone`; remove single-location auto-resolve; extend response with `serviceName` and `locationName`

### Phase 3 — Hook layer
- [x] `apps/web/src/hooks/usePublicBooking.ts` — implement all five hooks with React Query

### Phase 4 — UI components
- [x] `apps/web/app/(public)/layout.tsx` — minimal public layout (no dashboard chrome, no auth)
- [x] `apps/web/app/(public)/book/[tenantSlug]/page.tsx` — Server Component: resolve slug, prefetch locations, pass to `<BookingWidget>`; call `notFound()` on unknown slug
- [x] `apps/web/app/(public)/book/[tenantSlug]/not-found.tsx` — 404 page for unknown tenant slug
- [x] `BookingWidget.tsx` — booking state, section orchestration, single-location auto-init, confirmation swap
- [x] `LocationSection.tsx` — card grid; hidden when single-location
- [x] `ServiceSection.tsx` — card grid
- [x] `StaffSection.tsx` — "Any available" card + staff cards; placeholder state
- [x] `DateStrip.tsx` — 7-day window with prev/next; today indicator; selected state
- [x] `TimeSlotGrid.tsx` — slot button grid (3–4 cols); loading skeleton; unavailable disabled; empty state
- [x] `DateTimeSection.tsx` — composes `DateStrip` + `TimeSlotGrid`; placeholder state; timezone-aware display
- [x] `DetailsSection.tsx` — RHF + zod form (name, phone, email); submit button with loading state; inline error messages
- [x] `BookingConfirmation.tsx` — success screen; shows service/staff/date-time/location/booking ID; "Book another" link
- [x] `FloatingNav.tsx` — fixed right-edge mobile nav; section pills; IntersectionObserver for active tracking; backdrop-blur half-transparent style

### Phase 5 — Verification
- [x] All tests green; `pnpm typecheck` passes
- [x] Browser verification (Playwright MCP): single-location tenant — full happy path, confirmation screen
- [x] Browser verification (Playwright MCP): multi-location tenant — location selection step visible and functional
- [x] Browser verification (Playwright MCP): mobile viewport — floating nav visible, pill click scrolls to correct section
- [x] Browser verification (Playwright MCP): unavailable slot disabled; 409 error clears slot and shows message

### Phase 6 — Timezone fix
- [x] Fix `slotsForWindows` in `availability.ts`: add `localMidnightUTC` helper; use location timezone for slot base timestamp
- [x] Fix booked-rows conflict query: use `$2::date::timestamp AT TIME ZONE $3` bounds so edge-of-day bookings are correctly included/excluded
- [x] Add `timezone` param to `generateStaffSlots` and `generateAnyAvailableSlots`
- [x] Public slots route (`/api/public/[tenantSlug]/services/[serviceId]/slots`): fetch and pass location timezone to generators
- [x] Private slots route (`/api/tenants/[tenantId]/services/[serviceId]/slots`): fetch and pass location timezone to generators
- [x] All 125 tests green; API verified: Europe/Riga slots start at 06:00Z (= 09:00 local) instead of 09:00Z (= 12:00 local)
