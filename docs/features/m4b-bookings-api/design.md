# Design: m4b-bookings-api

## Problem

M4 delivered service and availability management but deferred all booking operations. M5b
(calendar view), M6 (manual appointment entry), and M7 (booking web widget) all depend on a
booking data layer that doesn't exist yet. This milestone delivers the full bookings API in one
place: owner-side authenticated endpoints and the public client-facing endpoint, so all subsequent
milestones build on a stable, tested contract.

Constraints:
- Raw SQL, no ORM (ADR-004).
- Owner routes behind JWT auth; every owner query inside `withTenantContext` (ADR-005, ADR-007).
- No new tables — `bookings` was defined in M1.

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/tenants/[tenantId]/bookings/route.ts` | Owner-side booking list + create handlers |
| `apps/web/app/api/tenants/[tenantId]/bookings/[bookingId]/route.ts` | Owner-side booking update handler |
| `apps/web/app/api/public/[tenantSlug]/services/[serviceId]/slots/route.ts` | Public slot generation handler |
| `apps/web/app/api/public/[tenantSlug]/bookings/route.ts` | Public booking creation handler |
| `apps/web/src/lib/server/availability.ts` | Shared helpers: overlap check, availability-rule check, slot generation |

`apps/web/src/lib/server/withAuth.ts` and `apps/web/src/lib/server/withTenantContext.ts` are reused
unchanged from M3/M4.

## Contracts

### Owner routes

All require `Authorization: Bearer <token>`. The JWT's `tenantId` must match `:tenantId` → 403.

---

#### `GET /tenants/:tenantId/bookings`

**Query params**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| from | ISO 8601 | no | Lower bound on `start_at` (inclusive) |
| to | ISO 8601 | no | Upper bound on `start_at` (inclusive) |
| serviceId | UUID | no | Filter to one service |
| status | `active` \| `cancelled` | no | Omit = all statuses |

**Response 200**
```json
[{
  "id": "uuid",
  "tenantId": "uuid",
  "serviceId": "uuid",
  "staffId": "uuid | null",
  "staffName": "string | null",
  "clientName": "string",
  "clientPhone": "string",
  "clientEmail": "string | null",
  "startAt": "iso8601",
  "endAt": "iso8601",
  "status": "pending | confirmed | cancelled",
  "notes": "string | null",
  "createdAt": "iso8601"
}]
```

**Errors** — `400` invalid date param, `403`

---

#### `POST /tenants/:tenantId/bookings`

**Request**
```json
{
  "serviceId": "uuid",
  "locationId": "uuid",
  "staffId": "uuid | null (optional — null = auto-assign)",
  "clientName": "string",
  "clientPhone": "string (min 7 chars, required)",
  "clientEmail": "string (email, optional)",
  "startAt": "iso8601",
  "endAt": "iso8601",
  "notes": "string (optional)",
  "override": false
}
```

Staff assignment rules:
- `staffId` provided, `override: false`: validates staff is active, assigned to the service at `locationId`, and has no overlapping booking → `422` or `409` if not
- `staffId` null, `override: false`: auto-assigns first free active+qualified staff at `locationId` (ordered by `created_at`) → `409` if all are booked
- `staffId` provided, `override: true`: skips all checks, assigns that staff directly
- `staffId` null, `override: true`: assigns first qualified staff regardless of conflicts

When `override: true`: skips `checkStaffOverlap` and conflict detection.

**Response 201** — booking object (same shape as GET list item, includes `staffId` and `staffName`).

**Errors** — `403`, `404` service not found, `409` overlap (only when override is absent/false), `422` validation or staff not eligible

---

#### `PATCH /tenants/:tenantId/bookings/:id`

All fields optional; at least one must be present.

**Request**
```json
{
  "status": "confirmed | cancelled",
  "startAt": "iso8601",
  "endAt": "iso8601"
}
```

**Response 200** — updated booking object.

**Errors** — `403`, `404`, `409` overlap or already-cancelled, `422`

---

### Public routes

No auth required. Tenant is resolved by slug.

---

#### `GET /public/:tenantSlug/services/:serviceId/slots`

Returns available booking slots for a service on a given date.

**Query params**: `date=YYYY-MM-DD` (required), `duration=minutes` (required).

**Response 200**
```json
[{ "startAt": "iso8601", "endAt": "iso8601" }]
```

**Errors** — `400` missing/invalid params, `404` tenant slug not found

---

#### `POST /public/:tenantSlug/bookings`

**Request**
```json
{
  "serviceId": "uuid",
  "clientName": "string",
  "clientEmail": "string",
  "startAt": "iso8601",
  "endAt": "iso8601"
}
```

**Response 201** — booking object (omits `tenantId`).

**Errors** — `404` slug not found, `409` overlap or outside-availability, `422` validation, `429` rate-limited

Note: no JWT, no RLS context. Handler resolves `tenantId` from the slug lookup and passes it
explicitly into queries.

---

## Shared helpers — `apps/web/src/lib/server/availability.ts`

### `checkOverlap(client, serviceId, start, end, excludeId?)`

Two bookings overlap when `A.start_at < B.end_at AND B.start_at < A.end_at`.

```sql
SELECT 1 FROM bookings
WHERE service_id = $1
  AND status != 'cancelled'
  AND start_at < $3
  AND end_at   > $2
  [AND id != $4]
```

Returns 409 `{ "error": "overlap" }` if any row found.

### `checkStaffOverlap(client, staffId, start, end, excludeId?)`

Same overlap logic scoped to a specific staff member instead of a service.

### `generateStaffSlots(client, staffId, date, durationMinutes)`

Generates slots for a single staff member on `date`:
1. Fetches `staff_schedules` windows for the matching `day_of_week`
2. Applies `staff_schedule_overrides`: `available` type adds windows, `not_available` type removes blocks
3. Marks each slot `available: false` if a non-cancelled booking overlaps

### `generateAnyAvailableSlots(client, tenantId, serviceId, locationId, date, durationMinutes)`

Union of slots across all active staff assigned to `serviceId` at `locationId`. A slot's `available`
flag is `true` if at least one staff member is free at that time.

---

## Rejected alternatives

**Soft delete via `DELETE` verb** — `PATCH status=cancelled` preserves history and is consistent
with the `status` field already in the schema.

**Inline validation in route handlers** — extracted to `availability.ts` so owner and public
routes share identical logic without duplication.

**Pagination on list** — deferred; consistent with M4 list endpoints.

**`pending` → `confirmed` on manual create** — creates as `pending` for uniform flow whether
originating from manual entry (M6) or public widget (M7).

**Tenant UUID in public URL** — slugs are the public identifier (used in hosted booking page
URLs). Exposing UUIDs in public routes leaks internal IDs unnecessarily.

## Trade-offs accepted

- All times are UTC. Timezone conversion is a UI concern. A per-tenant timezone setting is post-MVP.
- No bulk operations.
- No search by client name or email — deferred post-MVP.
- Rate limiting is per tenant slug + IP; a simple in-process counter suffices at MVP scale.

## Out of scope

- Booking confirmation emails (post-MVP).
- Recurring bookings (post-MVP).
- Hard delete.
- Client-facing booking UI — web widget and hosted page (M7, M8).

## Edge cases

| Scenario | Handling |
|----------|----------|
| Reschedule to same slot | Overlap check excludes self (`excludeId`); passes if no other conflict |
| Cancel already-cancelled booking | 409 `{ "error": "already_cancelled" }` |
| `from` without `to` (or vice versa) | Accepted — open-ended range query |
| Service belongs to a different tenant | 404 (not 403) — avoids leaking existence across tenants |
| Booking spans midnight | `day_of_week` uses day of `start_at`; availability rule must cover full span |
| Public booking: slug not found | 404 — do not distinguish slug-not-found from service-not-found |
