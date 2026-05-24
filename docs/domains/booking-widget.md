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
| `apps/web/app/api/public/[tenantSlug]/services/[serviceId]/available-dates/route.ts` | Dates with at least one available slot in a window |
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

### `GET /api/public/:tenantSlug/services/:serviceId/available-dates`

| Param | Required | Description |
|-------|----------|-------------|
| locationId | yes | Location to scope staff availability |
| startDate | yes | YYYY-MM-DD — first date of window |
| endDate | yes | YYYY-MM-DD — last date of window |
| staffId | no | Specific staff member; absent = "any available" |

Window capped at 31 days server-side. Returns only dates that have at least one slot with `available: true`.

**Response 200**
```json
["2026-05-15", "2026-05-20", "2026-05-21"]
```

Delegates to `generateAvailableDatesInWindow` from `apps/web/src/lib/server/availability.ts`. Issues at most 4 DB queries for the entire window regardless of window size or staff count (staff list, schedules, overrides, bookings — all batch-fetched), then computes slot availability in memory.

**Errors:** `400` missing params or window > 31 days, `404` tenant or service not found

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
2. Fetch active locations and all services in parallel
3. For single-location tenants: also fetch all staff-by-service at the known location
4. Pass `tenantName`, `tenantSlug`, `initialLocations`, `initialServices`, `initialStaffByService` to `<BookingWidget>`

`initialServices` and `initialStaffByService` are passed to React Query as `initialData`, eliminating client-side fetch waterfalls on page load.

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
| `apps/web/src/page-components/booking/BookingWidget.tsx` | Client Component; owns all booking state; accepts `initialServices` and `initialStaffByService` |
| `apps/web/src/page-components/booking/LocationSection.tsx` | Card grid of active locations |
| `apps/web/src/page-components/booking/ServiceSection.tsx` | Card grid of all tenant services; skeleton loader when `isLoading` |
| `apps/web/src/page-components/booking/StaffSection.tsx` | "Any available" card + staff member cards; skeleton loader when `isLoading && prerequisiteMet` |
| `apps/web/src/page-components/booking/DateTimeSection.tsx` | Owns `month: Date` state (first of current month); calls `usePublicAvailableDates` with month boundaries; composes `BookingCalendar` and `TimeSlotGrid`; clears `selectedDate` on month change |
| `apps/web/src/page-components/booking/BookingCalendar.tsx` | Thin wrapper around shadcn `Calendar` (react-day-picker). Receives `availableDates`, `selectedDate`, `month`, callbacks, `minMonth`, `maxMonth`; disables unavailable and past days. When `availableDates === null` renders a structural `CalendarSkeleton` in place of the real calendar (header row + weekday row + 6 × 7 `aspect-square` cells); when non-null renders the real calendar with no overlay. |
| `apps/web/src/page-components/booking/TimeSlotGrid.tsx` | Slot buttons in 3–4 column grid; unavailable slots dimmed; skeleton loader; empty state |
| `apps/web/src/page-components/booking/DetailsSection.tsx` | Name/phone/email form (RHF + zod); submit with loading state |
| `apps/web/src/page-components/booking/BookingConfirmation.tsx` | Success screen with booking summary and "Book another" reset |
| `apps/web/src/page-components/booking/FloatingNav.tsx` | Fixed right-edge circular buttons (`MapPin`, `Tag`, `User`, `Clock`); active section tracked via `IntersectionObserver`; `scrollIntoView` on click |

### Hooks

```ts
// apps/web/src/hooks/usePublicBooking.ts
function usePublicLocations(tenantSlug: string): UseQueryResult<PublicLocation[]>
function usePublicServices(tenantSlug: string, initialData?: PublicService[]): UseQueryResult<PublicService[]>
function usePublicStaff(
  tenantSlug: string,
  serviceId: string | null,
  locationId: string | null,
  initialData?: PublicStaffMember[],
): UseQueryResult<PublicStaffMember[]>   // disabled when serviceId or locationId is null
function usePublicAvailableDates(
  tenantSlug: string,
  serviceId: string | null,
  locationId: string | null,
  staffId: string | null,     // null = "any available"
  startDate: string | null,   // YYYY-MM-DD — max(today, first of displayed month)
  endDate: string | null,     // YYYY-MM-DD — last day of displayed month
  staffSelected: boolean,
): UseQueryResult<string[]>             // enabled when staffSelected + serviceId + locationId + startDate + endDate set
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

### BookingCalendar behaviour

- `month: Date` state (first day of displayed month) lives in `DateTimeSection`; `BookingCalendar` is fully controlled via props.
- `availableDates: Set<string> | null` — when `null` (query in-flight), a structural `CalendarSkeleton` is rendered in place of the real calendar (no overlay). When non-null, the real calendar renders: days in the set are enabled; all others are disabled (greyed out, not clickable).
- Past dates (before today) are always disabled regardless of availability.
- Month navigation: back arrow disabled when on `minMonth` (current month); forward arrow disabled at `maxMonth` (3 months from today).
- On month change, `selectedDate` is cleared via `onDateSelect(null)` and a new `usePublicAvailableDates` fetch fires for the new month's window.
- `startDate` passed to the hook = max(today, first of `month`); `endDate` = last day of `month`.

### SSR pre-fetch

`page.tsx` fetches locations + services in parallel. For single-location tenants it also fetches all staff-by-service in a single query. These are passed to `BookingWidget` as `initialServices: PublicService[]` and `initialStaffByService: Record<string, PublicStaffMember[]>`, then forwarded to React Query as `initialData`.

Multi-location tenants: `initialStaffByService` is `{}` (location unknown at SSR time); staff fetches client-side after service + location selection.

## Constraints

- No `override` flag — public clients cannot bypass conflict checks.
- Upstash rate limiting on `POST /api/public/*` is required before the widget goes live. The in-memory limiter was removed in M6f.
- `clientPhone` required (min 7 chars). `clientEmail` optional.
- No client accounts — public flow, no auth required.
- Single-location tenants: `LocationSection` not rendered; `selectedLocationId` pre-set; location pill omitted from `FloatingNav`.
- `available-dates` window capped at 31 days per request; `DateTimeSection` requests one full calendar month at a time.
