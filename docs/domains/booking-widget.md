# Domain: Booking Widget

Public client-facing booking flow at `/book/:tenantSlug`. Clients select location (if multi-location), service, staff, date/time, and submit their details. No auth required. Rendered as a Server Component (SSR) for fast first paint and SEO.

## Schema

See [bookings.md](bookings.md), [locations.md](locations.md), [services.md](services.md), [staff.md](staff.md).

## API — Public routes

No auth required. All queries use explicit `WHERE tenant_id = $n` — no RLS context is set. Tenant is resolved by slug; 404 if not found.

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/public/[tenantSlug]/locations/route.ts` | Active locations for tenant |
| `apps/web/app/api/public/[tenantSlug]/services/route.ts` | All services for tenant |
| `apps/web/app/api/public/[tenantSlug]/services/[serviceId]/staff/route.ts` | Active staff for service at location |
| `apps/web/app/api/public/[tenantSlug]/services/[serviceId]/slots/route.ts` | Available slots |
| `apps/web/app/api/public/[tenantSlug]/bookings/route.ts` | Create booking |

---

### `GET /api/public/:tenantSlug/locations`

**Response 200**
```json
[{ "id": "uuid", "name": "string", "address": "string | null", "timezone": "string" }]
```

**Errors:** `404` tenant not found

---

### `GET /api/public/:tenantSlug/services`

**Response 200**
```json
[{ "id": "uuid", "name": "string", "description": "string | null", "durationMinutes": "number" }]
```

**Errors:** `404` tenant not found

---

### `GET /api/public/:tenantSlug/services/:serviceId/staff?locationId=uuid`

`locationId` required — 422 if absent.

Returns active staff assigned to the service at the given location via `staff_services`.

**Response 200**
```json
[{ "id": "uuid", "name": "string" }]
```

**Errors:** `422` missing `locationId`, `404` tenant or service not found

---

### `GET /api/public/:tenantSlug/services/:serviceId/slots`

| Param | Required | Description |
|-------|----------|-------------|
| date | yes | YYYY-MM-DD |
| locationId | yes | Location to scope staff availability |
| staffId | no | Specific staff member; absent = "any available" |
| duration | no | Override duration (minutes); defaults to `services.duration_minutes` |

**Response 200**
```json
[{ "startAt": "iso8601", "endAt": "iso8601", "available": "boolean" }]
```

Delegates to `generateStaffSlots` (staffId provided) or `generateAnyAvailableSlots` (staffId absent) from `apps/web/src/lib/server/availability.ts`.

**Errors:** `400` missing required params, `404` tenant or service not found

---

### `POST /api/public/:tenantSlug/bookings`

No `override` flag — public clients cannot bypass conflict checks.

**Request**
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

**Staff assignment**
- `staffId` provided: validates active, assigned to service at `locationId`, no overlap → 409 if conflict
- `staffId` null: auto-assigns first free active+qualified staff at `locationId` → 409 if none available

**Response 201**
```json
{
  "id": "uuid",
  "serviceId": "uuid", "serviceName": "string",
  "staffId": "uuid | null", "staffName": "string | null",
  "locationId": "uuid", "locationName": "string",
  "clientName": "string", "clientPhone": "string", "clientEmail": "string | null",
  "startAt": "iso8601", "endAt": "iso8601",
  "status": "pending", "createdAt": "iso8601"
}
```

**Errors:** `404`, `409` slot overlap or no staff available, `422`, `429` rate-limited (Upstash required before go-live)

---

## Frontend

### Route

| Route | File | Rendering |
|-------|------|-----------|
| `/book/:tenantSlug` | `apps/web/app/(public)/book/[tenantSlug]/page.tsx` | Server Component (SSR) |
| `/book/:tenantSlug` (404) | `apps/web/app/(public)/book/[tenantSlug]/not-found.tsx` | 404 for unknown slug |

**Server Component fetch sequence:**
1. Resolve tenant by slug → call `notFound()` if absent
2. Fetch active locations (`WHERE tenant_id = ? AND is_active = true`, no RLS)
3. Pass `tenantName`, `tenantSlug`, `initialLocations` to `<BookingWidget>` (Client Component)

All subsequent data (services, staff, slots) is fetched client-side via React Query inside `BookingWidget`.

### Booking state

Owned by `BookingWidget`:

```ts
selectedLocationId: string | null   // auto-set to initialLocations[0].id for single-location tenants
selectedServiceId: string | null
selectedService: PublicService | null  // cached for durationMinutes
selectedStaffId: string | null | 'any'  // 'any' = "Any available"
selectedSlot: PublicSlot | null
bookingResult: PublicBookingResult | null  // set on success; shows BookingConfirmation
```

### Section structure

```
<BookingWidget>
  Business header (tenant name)
  <LocationSection />    — only if initialLocations.length > 1
  <ServiceSection />
  <StaffSection />       — placeholder ("Select a service first") if no service selected
  <DateTimeSection />    — placeholder ("Select a staff member first") if no staff selected
  <DetailsSection />     — always visible; submit gated on slot + name + phone
  <FloatingNav />        — mobile only (md:hidden)
```

When `bookingResult` is set, `<BookingConfirmation>` replaces all content.

### Components

| File | Responsibility |
|------|----------------|
| `apps/web/app/(public)/layout.tsx` | Minimal public layout — no auth, no dashboard chrome |
| `apps/web/src/page-components/booking/BookingWidget.tsx` | Client Component; owns all booking state |
| `apps/web/src/page-components/booking/LocationSection.tsx` | Card grid of active locations |
| `apps/web/src/page-components/booking/ServiceSection.tsx` | Card grid of all tenant services |
| `apps/web/src/page-components/booking/StaffSection.tsx` | "Any available" card + staff member cards |
| `apps/web/src/page-components/booking/DateTimeSection.tsx` | Composes `DateStrip` and `TimeSlotGrid` |
| `apps/web/src/page-components/booking/DateStrip.tsx` | 7-day window; prev/next shifts by 7 days; 60-day horizon; today highlighted |
| `apps/web/src/page-components/booking/TimeSlotGrid.tsx` | Slot buttons in 3–4 column grid; unavailable slots dimmed; skeleton loader; empty state |
| `apps/web/src/page-components/booking/DetailsSection.tsx` | Name/phone/email form (RHF + zod); submit with loading state |
| `apps/web/src/page-components/booking/BookingConfirmation.tsx` | Success screen with booking summary and "Book another" reset |
| `apps/web/src/page-components/booking/FloatingNav.tsx` | Fixed right-edge circular buttons (`MapPin`, `Tag`, `User`, `Clock`); active section tracked via `IntersectionObserver`; `scrollIntoView` on click |

### Hooks

```ts
// apps/web/src/hooks/usePublicBooking.ts
function usePublicLocations(tenantSlug: string): UseQueryResult<PublicLocation[]>
function usePublicServices(tenantSlug: string): UseQueryResult<PublicService[]>
function usePublicStaff(
  tenantSlug: string,
  serviceId: string | null,
  locationId: string | null
): UseQueryResult<PublicStaffMember[]>   // disabled when serviceId or locationId is null
function usePublicSlots(
  tenantSlug: string,
  serviceId: string | null,
  locationId: string | null,
  staffId: string | null,     // null = "any available"
  date: string | null
): UseQueryResult<PublicSlot[]>          // disabled until serviceId, locationId, date are set
function useCreatePublicBooking(
  tenantSlug: string
): UseMutationResult<PublicBookingResult, ApiError, CreatePublicBookingInput>

interface PublicLocation    { id: string; name: string; address: string | null; timezone: string }
interface PublicService     { id: string; name: string; description: string | null; durationMinutes: number }
interface PublicStaffMember { id: string; name: string }
interface PublicSlot        { startAt: string; endAt: string; available: boolean }

interface CreatePublicBookingInput {
  serviceId: string; locationId: string; staffId: string | null
  clientName: string; clientPhone: string; clientEmail?: string
  startAt: string; endAt: string
}

interface PublicBookingResult {
  id: string
  serviceId: string; serviceName: string
  staffId: string | null; staffName: string | null
  locationId: string; locationName: string
  clientName: string; clientPhone: string; clientEmail: string | null
  startAt: string; endAt: string; status: string; createdAt: string
}
```

Slot times are displayed in the location's IANA timezone via `Intl.DateTimeFormat`.

`"Any available"` is a UI concept added locally in `StaffSection` — not returned by the staff endpoint.

## Constraints

- No `override` flag — public clients cannot bypass conflict checks.
- Upstash rate limiting on `POST /api/public/*` is required before the widget goes live. The in-memory limiter was removed in M6f.
- `clientPhone` required (min 7 chars). `clientEmail` optional.
- No client accounts — public flow, no auth required.
- Single-location tenants: `LocationSection` not rendered; `selectedLocationId` pre-set; location pill omitted from `FloatingNav`.
