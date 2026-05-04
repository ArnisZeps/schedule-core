# Design: m4b-bookings-api

## Problem

M4 delivered service and availability management but deferred all booking operations. M5b
(calendar view), M6 (manual appointment entry), and M7 (booking web widget) all depend on a
booking data layer that doesn't exist yet. This milestone delivers the full bookings API in one
place: owner-side authenticated endpoints and the public client-facing endpoint, so all subsequent
milestones build on a stable, tested contract.

Constraints:
- Raw SQL, no ORM (ADR-004).
- Express routers (ADR-002).
- Owner routes behind JWT auth; every owner query inside `withTenantContext` (ADR-005, ADR-007).
- No new tables — `bookings` was defined in M1.

## Components

| File | Responsibility |
|------|----------------|
| `apps/api/src/routes/bookings.ts` | Owner-side booking handlers and router |
| `apps/api/src/routes/public.ts` | Public (no-auth) slots + booking creation handlers |
| `apps/api/src/lib/availability.ts` | Shared helpers: overlap check, availability-rule check, slot generation |
| `apps/api/src/app.ts` | Mount routers at `/tenants/:tenantId/bookings` and `/public/:tenantSlug` |

`apps/api/src/middleware/auth.ts` and `apps/api/src/middleware/tenant-context.ts` are reused
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
  "clientName": "string",
  "clientEmail": "string",
  "startAt": "iso8601",
  "endAt": "iso8601",
  "status": "pending | confirmed | cancelled",
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
  "clientName": "string",
  "clientEmail": "string",
  "startAt": "iso8601",
  "endAt": "iso8601"
}
```

**Response 201** — booking object (same shape as list item).

**Errors** — `403`, `404` service not found, `409` overlap or outside-availability, `422` validation

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

## Shared helpers — `apps/api/src/lib/availability.ts`

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

### `checkWithinAvailability(client, serviceId, start, end)`

Validates the slot falls entirely within an availability window on the same day of the week.

```sql
SELECT 1 FROM availability_rules
WHERE service_id = $1
  AND day_of_week = $2
  AND start_time <= $3::time
  AND end_time   >= $4::time
```

`day_of_week` is extracted from `start_at` in UTC (0 = Sunday). Returns 409
`{ "error": "outside_availability" }` if no row found.

### `generateSlots(client, serviceId, date, durationMinutes)`

Walks the availability windows for the service on `date`'s day of week, subdivides into
`durationMinutes` chunks, subtracts existing non-cancelled bookings, returns free slots.

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
