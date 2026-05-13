# Design: m7-booking-web-widget

## Problem

All prerequisite data layers exist (services, staff, locations, availability, public booking API from M4b/M6b/M6c/M6d) but there is no client-facing UI. Clients cannot self-book. M7 delivers the public booking page at `/book/:tenantSlug`: a single-page layout where a client selects location (if multi-location), service, staff, date/time, and enters their details before submitting.

Constraints:
- No client accounts — public flow, no auth (ADR-007 is owner-only).
- SSR via Next.js App Router `(public)` route group (ADR-010). The page is a Server Component; interactive state lives in a nested Client Component.
- shadcn/ui + Radix primitives (ADR-009).
- Raw SQL, no ORM (ADR-004). Public route handlers resolve `tenant_id` from slug; no RLS context is set — all queries use explicit `WHERE tenant_id = $n`.
- Rate limiting on `/api/public/*` must be replaced with Upstash before this feature can go live (ADR-011 prerequisite).

## Components

### New files

| File | Responsibility |
|------|----------------|
| `apps/web/app/(public)/layout.tsx` | Minimal layout for the public route group — no auth, no dashboard chrome |
| `apps/web/app/(public)/book/[tenantSlug]/page.tsx` | Server Component: resolves tenant slug, fetches initial location list, passes to `<BookingWidget>` |
| `apps/web/app/(public)/book/[tenantSlug]/not-found.tsx` | 404 rendered when `notFound()` is called for an unknown slug |
| `apps/web/src/page-components/booking/BookingWidget.tsx` | Client Component: owns all booking state, renders sections, orchestrates flow |
| `apps/web/src/page-components/booking/FloatingNav.tsx` | Mobile-only fixed right-edge nav with section pills; calls `scrollIntoView` |
| `apps/web/src/page-components/booking/LocationSection.tsx` | Card grid of active locations; hidden when tenant has exactly one location |
| `apps/web/src/page-components/booking/ServiceSection.tsx` | Card grid of all tenant services |
| `apps/web/src/page-components/booking/StaffSection.tsx` | "Any available" card + staff member cards; shows placeholder when no service selected |
| `apps/web/src/page-components/booking/DateTimeSection.tsx` | Composes `DateStrip` and `TimeSlotGrid`; shows placeholder when no staff selected |
| `apps/web/src/page-components/booking/DateStrip.tsx` | Horizontal 7-day window with prev/next navigation; each day is a selectable button |
| `apps/web/src/page-components/booking/TimeSlotGrid.tsx` | Grid of time-slot buttons; loading skeleton; empty state |
| `apps/web/src/page-components/booking/DetailsSection.tsx` | Name / phone / email form (RHF + zod); submit button with loading state |
| `apps/web/src/page-components/booking/BookingConfirmation.tsx` | Success screen with booking summary and "Book another" reset link |
| `apps/web/src/hooks/usePublicBooking.ts` | All public query + mutation hooks (React Query) |
| `apps/web/app/api/public/[tenantSlug]/locations/route.ts` | `GET` — active locations for tenant |
| `apps/web/app/api/public/[tenantSlug]/services/route.ts` | `GET` — all services for tenant |
| `apps/web/app/api/public/[tenantSlug]/services/[serviceId]/staff/route.ts` | `GET` — active staff for service + location |

### Modified files

| File | Change |
|------|--------|
| `apps/web/app/api/public/[tenantSlug]/services/[serviceId]/slots/route.ts` | Add `locationId` (required) and `staffId` (optional) params; make `duration` optional (server falls back to `services.duration_minutes`) |
| `apps/web/app/api/public/[tenantSlug]/bookings/route.ts` | Accept `locationId` (required), `staffId` (nullable), `clientPhone` (required, was missing from M4b); remove single-location auto-resolve; extend response with `serviceName` and `locationName` |

## Contracts

### New public API endpoints

All endpoints resolve `tenantId` from slug (`404` if not found). No auth. No RLS — explicit `WHERE tenant_id = $n` in every query.

---

#### `GET /public/:tenantSlug/locations`

Returns active locations only.

**Response 200:**
```json
[{
  "id": "uuid",
  "name": "string",
  "address": "string | null",
  "timezone": "string"
}]
```

**Errors:** `404` tenant not found.

---

#### `GET /public/:tenantSlug/services`

Returns all services for the tenant.

**Response 200:**
```json
[{
  "id": "uuid",
  "name": "string",
  "description": "string | null",
  "durationMinutes": number
}]
```

**Errors:** `404` tenant not found.

---

#### `GET /public/:tenantSlug/services/:serviceId/staff?locationId=uuid`

Returns active staff assigned to the service at the given location (via `staff_services`).

**Query params:** `locationId` — required (422 if absent).

**Response 200:**
```json
[{
  "id": "uuid",
  "name": "string"
}]
```

**Errors:** `422` missing `locationId`, `404` tenant or service not found.

---

### Extended public API endpoints

#### `GET /public/:tenantSlug/services/:serviceId/slots`

Extended query params:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| date | YYYY-MM-DD | yes | Date to generate slots for |
| locationId | uuid | yes | Location to scope staff availability |
| staffId | uuid | no | If provided, slots for that staff member only; otherwise "any available" across all qualified staff at location |
| duration | minutes | no | Override duration; defaults to `services.duration_minutes` |

**Response 200:**
```json
[{ "startAt": "iso8601", "endAt": "iso8601", "available": boolean }]
```

**Errors:** `400` missing required params, `404` tenant or service not found.

**Implementation note:** delegates to `generateStaffSlots` (staffId provided) or `generateAnyAvailableSlots` (staffId absent) from `apps/web/src/lib/server/availability.ts` — no new helper needed.

---

#### `POST /public/:tenantSlug/bookings` (extended)

**Request body:**
```json
{
  "serviceId": "uuid",
  "locationId": "uuid",
  "staffId": "uuid | null",
  "clientName": "string",
  "clientPhone": "string (min 7 chars, required)",
  "clientEmail": "string | null",
  "startAt": "iso8601",
  "endAt": "iso8601"
}
```

Staff assignment rules (no `override` flag — public clients cannot bypass conflict checks):
- `staffId` provided: validates staff is active, assigned to service at `locationId`, no overlapping booking → `409` if conflict
- `staffId` null: auto-assigns first free active + qualified staff at `locationId` → `409` if none available

**Response 201:**
```json
{
  "id": "uuid",
  "serviceId": "uuid",
  "serviceName": "string",
  "staffId": "uuid | null",
  "staffName": "string | null",
  "locationId": "uuid",
  "locationName": "string",
  "clientName": "string",
  "clientPhone": "string",
  "clientEmail": "string | null",
  "startAt": "iso8601",
  "endAt": "iso8601",
  "status": "pending",
  "createdAt": "iso8601"
}
```

**Errors:** `404` slug not found, `409` slot overlap or no staff available, `422` validation, `429` rate-limited.

---

### Page layout and rendering

`/book/:tenantSlug` renders as a Server Component:
1. Fetches tenant row by slug; calls `notFound()` if absent.
2. Fetches `locations WHERE tenant_id = ? AND is_active = true` (no RLS — direct query with explicit tenant_id).
3. Passes `tenantName`, `tenantSlug`, `initialLocations` to `<BookingWidget>` (Client Component).

All subsequent data (services, staff, slots) is fetched client-side via React Query inside `<BookingWidget>`.

**Booking state owned by `BookingWidget`:**
```ts
selectedLocationId: string | null   // null until chosen (or auto-set for single-location)
selectedServiceId: string | null
selectedService: PublicService | null  // cached for durationMinutes
selectedStaffId: string | null | 'any'  // 'any' = "Any available"
selectedSlot: PublicSlot | null
bookingResult: PublicBookingResult | null  // set on success → shows confirmation
```

Single-location tenants: `selectedLocationId` is initialised to `initialLocations[0].id` immediately; `LocationSection` is not rendered.

**Section structure:**
```
<BookingWidget>
  Business header (tenant name)
  <LocationSection id="section-location" />   — only if initialLocations.length > 1
  <ServiceSection  id="section-service" />
  <StaffSection    id="section-staff" />       — placeholder if no service selected
  <DateTimeSection id="section-datetime" />   — placeholder if no staff selected
  <DetailsSection  />                          — form always visible; submit gated on slot + name + phone
  <FloatingNav />                              — mobile only (md:hidden)
```

When `bookingResult` is set, `<BookingConfirmation>` replaces the entire widget content.

### Section states

Sections below an unmet prerequisite are rendered but show a placeholder instead of interactive content. This avoids layout shift and makes the floating nav always functional.

| Section | Prerequisite | Placeholder |
|---------|-------------|-------------|
| Service | — | Always interactive |
| Staff | Service selected | "Select a service first" |
| Date/Time | Staff selected (incl. "any") | "Select a staff member first" |
| Details | Slot selected | Form always visible; submit disabled until slot + name + phone |

### DateStrip

- Shows 7 days at a time. Prev/Next arrow buttons shift the window by 7 days. Window covers 60 days from today.
- Each day card shows: abbreviated day name + day number (e.g. `Mon 12`). Today distinguished with a subtle ring.
- Selected date: accent background.
- No pre-emptive availability indicators on dates — empty-state message in TimeSlotGrid is sufficient.

### TimeSlotGrid

- Fetches on date change; shows skeleton loader.
- Slots rendered as buttons in a responsive 3–4 column grid. Format: `9:00 AM`.
- Unavailable slots (`available: false`) rendered as disabled (dimmed, not clickable).
- Empty state (zero slots or all unavailable): "No available times on this date. Try a different date."

### FloatingNav (mobile only)

```
fixed right-3 top-1/2 -translate-y-1/2
flex flex-col gap-2
md:hidden
```

One circular button per visible section: `MapPin` (location, if multi), `Tag` (service), `User` (staff), `Clock` (time).

Each button: `bg-background/50 backdrop-blur-sm border rounded-full w-10 h-10`.
Active section button: `bg-background/90 border-primary`.

On click: `document.getElementById('section-{name}')?.scrollIntoView({ behavior: 'smooth' })`.

Active section tracked by `IntersectionObserver` watching each section's ref.

### Hook interfaces (`apps/web/src/hooks/usePublicBooking.ts`)

```ts
function usePublicLocations(tenantSlug: string): UseQueryResult<PublicLocation[]>
function usePublicServices(tenantSlug: string): UseQueryResult<PublicService[]>
function usePublicStaff(
  tenantSlug: string,
  serviceId: string | null,
  locationId: string | null
): UseQueryResult<PublicStaffMember[]>  // disabled when serviceId or locationId is null
function usePublicSlots(
  tenantSlug: string,
  serviceId: string | null,
  locationId: string | null,
  staffId: string | null,   // null = "any available"
  date: string | null
): UseQueryResult<PublicSlot[]>  // disabled until serviceId, locationId, date are set
function useCreatePublicBooking(
  tenantSlug: string
): UseMutationResult<PublicBookingResult, ApiError, CreatePublicBookingInput>

interface PublicLocation   { id: string; name: string; address: string | null; timezone: string }
interface PublicService    { id: string; name: string; description: string | null; durationMinutes: number }
interface PublicStaffMember { id: string; name: string }
interface PublicSlot       { startAt: string; endAt: string; available: boolean }

interface CreatePublicBookingInput {
  serviceId: string;
  locationId: string;
  staffId: string | null;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  startAt: string;
  endAt: string;
}

interface PublicBookingResult {
  id: string;
  serviceId: string; serviceName: string;
  staffId: string | null; staffName: string | null;
  locationId: string; locationName: string;
  clientName: string; clientPhone: string; clientEmail: string | null;
  startAt: string; endAt: string;
  status: string; createdAt: string;
}
```

Slot times are displayed in the location's timezone using `Intl.DateTimeFormat` with the location's IANA zone string.

## Rejected alternatives

**Wizard flow (step-by-step pages)** — rejected. Wizards hide later steps, add back-button state management complexity, and feel slow on mobile. A single-page layout with visible sections lets clients see what's coming and backtrack freely without losing selections.

**Progressive section hiding** — fully hiding sections below the active step avoids layout shift but prevents the floating nav from being useful and surprises clients when new sections appear. Placeholder states communicate pending prerequisites while keeping the layout stable.

**URL-based booking state (query params per step)** — makes the flow shareable mid-fill and handles browser back gracefully, but adds meaningful complexity for no MVP benefit.

**Separate `/slots/any` endpoint for "any available"** — same logic, doubled API surface. A `staffId` param on the existing slots endpoint cleanly covers both cases.

**`duration` as required param on slots endpoint** — the service duration is already in the database; requiring the client to pass it is redundant. Making it optional (server falls back to `duration_minutes`) is a backward-compatible improvement.

**"Any available" returned by the staff endpoint** — the staff endpoint returns only real people. "Any available" is a UI concept added locally in `StaffSection`. This keeps the API semantically clean.

## Trade-offs accepted

- Date strip shows no pre-emptive availability indicators per day. Pre-fetching a month of per-day slot availability would require a new aggregate endpoint or 30 parallel requests. Empty-state messaging in the time grid is adequate for MVP.
- `clientPhone` is now required on `POST /public/:tenantSlug/bookings`. This breaks the M4b contract, but no live external clients use the endpoint yet.
- Timezone display uses the location's `timezone` IANA string. The widget converts UTC timestamps with `Intl.DateTimeFormat`. No per-client timezone preference.
- Upstash rate limiting (Phase 0) is a hard prerequisite before the widget goes live. Without it, the public POST endpoint is unprotected against automated booking spam.
- No booking cancellation or modification for clients. Owners handle this via the dashboard.

## Out of scope

- Email confirmation after booking (post-MVP).
- Client-side booking cancellation or reschedule (post-MVP).
- Client accounts or login (post-MVP).
- Service photos or rich-text descriptions.
- Pricing or coupon codes.
- Recurring bookings.
- Hostname-based tenant routing (M8).
- Embeddable iframe widget (M9).
- Map or address rendering for location cards.
- Availability indicators on the date strip.

## Edge cases

| Scenario | Handling |
|----------|----------|
| Tenant has no active services | Service section shows empty state; no submission possible. |
| Service has no active staff at location | Staff section shows only "Any available". If no qualified staff exist, `generateAnyAvailableSlots` returns all slots `available: false`; time grid shows empty state. |
| Slot taken between selection and submit | `409` response: "This time was just taken. Please select another slot." Selected slot is cleared. |
| "Any available" selected but all staff booked on chosen date | Slots endpoint returns all slots with `available: false`; empty state shown in time grid. |
| Single-location tenant | `selectedLocationId` pre-set to the only location; `LocationSection` not rendered; location pill omitted from `FloatingNav`. |
| Multi-location tenant with no location selected | Staff and Date/Time sections show placeholder; submit blocked (`locationId` required in body). |
| `clientPhone` fewer than 7 chars | Client-side zod validation shows inline error before submit; API also returns 422. |
| `clientEmail` invalid format | Client-side zod validation; API validates on server. |
| Duplicate booking by same client | Not prevented. A slot not yet taken by another booking will succeed. |
| Browser back after confirmation | `BookingConfirmation` has a "Book another appointment" link; back-button behaviour is browser-default (returns to previous page). |
| `initialLocations` is empty (all locations deactivated) | `LocationSection` empty state shown; Staff/DateTime sections blocked; booking impossible until owner re-activates a location. |
