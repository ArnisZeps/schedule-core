# Design: M4 — Core API Surface

## Problem

M3 delivered authentication (signup/login, JWT issuance, RLS enforcement via the `schedulecore_app` role and `withTenantContext` helper). M4 adds the tenant-scoped CRUD API that authenticated business owners use to manage their account: the tenant record itself, bookable services, and weekly availability windows. This is the first milestone where `withTenantContext` is exercised outside of auth routes.

Constraints:
- Raw SQL, no ORM (ADR-004).
- Express routers, no framework magic (ADR-002).
- Row-level multi-tenancy; every tenant-scoped query runs inside `withTenantContext` (ADR-005, ADR-007).
- All routes behind JWT auth middleware from M3.
- No UI (roadmap: M4 is API-only).

## Components

| File | Responsibility |
|------|----------------|
| `apps/api/src/routes/tenants.ts` | Tenant CRUD handlers and router |
| `apps/api/src/routes/services.ts` | Service CRUD handlers and router |
| `apps/api/src/routes/availability-rules.ts` | Availability rule CRUD + overlap validation |
| `apps/api/src/middleware/auth.ts` | JWT verification — reused from M3, no changes |
| `apps/api/src/middleware/tenant-context.ts` | `withTenantContext` helper — reused from M3, no changes |

No new migration. All tables (`tenants`, `services`, `availability_rules`, `bookings`) and the `schedulecore_app` role are already in place from M1–M3.

## Contracts

All routes require `Authorization: Bearer <token>`. The auth middleware sets `req.auth = { userId, tenantId }`.

**Authorization rule for tenant-scoped routes:** `req.auth.tenantId` must equal the `:tenantId` path parameter. Return 403 on mismatch. Return 404 if the entity does not exist (do not leak existence across tenant boundaries).

---

### Tenants

Tenant creation is handled exclusively by `POST /auth/signup` (M3). M4 exposes read, update, and delete only — an authenticated user operates on their own tenant.

#### `GET /tenants/:id`

**Response 200**
```json
{ "id": "uuid", "name": "string", "slug": "string", "createdAt": "iso8601" }
```

**Errors**
- `403` `{ "error": "forbidden" }`
- `404` `{ "error": "not_found" }`

---

#### `PATCH /tenants/:id`
All fields optional; at least one must be present.

**Request**
```json
{ "name": "string?", "slug": "string?" }
```

**Response 200** — updated tenant object (same shape as GET).

**Errors**
- `403`, `404`
- `409` `{ "error": "slug_taken" }`
- `422` `{ "error": "validation_error", "details": ["string"] }`

---

#### `DELETE /tenants/:id`

**Response 204** — no body.

**Errors**
- `403`, `404`
- `409` `{ "error": "has_bookings" }` — tenant has existing bookings (`ON DELETE RESTRICT`)

---

### Services

All service routes enforce: `req.auth.tenantId === :tenantId` → 403. Service not found or belonging to another tenant → 404.

#### `POST /tenants/:tenantId/services`

**Request**
```json
{ "name": "string", "description": "string?", "durationMinutes": "integer (optional, default 30)" }
```

**Response 201**
```json
{ "id": "uuid", "tenantId": "uuid", "name": "string", "description": "string|null", "durationMinutes": "integer", "createdAt": "iso8601" }
```

**Errors**
- `403`
- `422` `{ "error": "validation_error", "details": ["string"] }`

---

#### `GET /tenants/:tenantId/services`

**Response 200**
```json
[{ "id": "uuid", "tenantId": "uuid", "name": "string", "description": "string|null", "durationMinutes": "integer", "createdAt": "iso8601" }]
```

**Errors** — `403`

---

#### `GET /tenants/:tenantId/services/:id`

**Response 200** — single service object.

**Errors** — `403`, `404`

---

#### `PATCH /tenants/:tenantId/services/:id`
All fields optional; at least one must be present. Pass `null` for `description` to clear it.

**Request**
```json
{ "name": "string?", "description": "string|null?", "durationMinutes": "integer?" }
```

**Response 200** — updated service object (same shape as POST 201).

**Errors** — `403`, `404`, `422`

---

#### `DELETE /tenants/:tenantId/services/:id`

**Response 204** — no body. `availability_rules` cascade-delete automatically.

**Errors**
- `403`, `404`
- `409` `{ "error": "has_bookings" }` — bookings reference this service (`ON DELETE RESTRICT`)

---

### Availability rules

All availability rule routes enforce the same tenant authorization as service routes. A rule whose parent service belongs to another tenant returns 404.

#### `POST /tenants/:tenantId/services/:serviceId/availability-rules`

**Request**
```json
{ "dayOfWeek": 0-6, "startTime": "HH:MM", "endTime": "HH:MM" }
```
`dayOfWeek`: 0 = Sunday … 6 = Saturday. Times are 24-hour strings, stored as Postgres `TIME`.

**Response 201**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "serviceId": "uuid",
  "dayOfWeek": 0-6,
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "createdAt": "iso8601"
}
```

**Errors**
- `403`, `404`
- `409` `{ "error": "overlap" }` — overlaps an existing rule for the same service + day
- `422` `{ "error": "validation_error", "details": ["string"] }` — e.g. `startTime >= endTime`

---

#### `GET /tenants/:tenantId/services/:serviceId/availability-rules`

**Response 200** — array of rule objects.

**Errors** — `403`, `404` (service not found)

---

#### `GET /tenants/:tenantId/services/:serviceId/availability-rules/:id`

**Response 200** — single rule object.

**Errors** — `403`, `404`

---

#### `PATCH /tenants/:tenantId/services/:serviceId/availability-rules/:id`
All fields optional; at least one must be present. Overlap check runs against the merged result, excluding the rule being updated.

**Request**
```json
{ "dayOfWeek": 0-6?, "startTime": "HH:MM"?, "endTime": "HH:MM"? }
```

**Response 200** — updated rule object.

**Errors** — `403`, `404`, `409 overlap`, `422`

---

#### `DELETE /tenants/:tenantId/services/:serviceId/availability-rules/:id`

**Response 204** — no body.

**Errors** — `403`, `404`

---

## Overlap validation logic

Two intervals `[A, B)` and `[C, D)` overlap when `A < D AND C < B`.

On create, check:
```sql
SELECT 1 FROM availability_rules
WHERE service_id = $1
  AND day_of_week = $2
  AND start_time < $4
  AND end_time   > $3
```

On update, add `AND id != $5` to exclude the rule being patched.

If any row is returned, reject with 409 `overlap`.

## FK violation handling

Both `tenants` and `services` deletes can hit Postgres error code `23503` (foreign_key_violation) due to `ON DELETE RESTRICT` on `bookings`. Catch this error code and return 409 `has_bookings`.

Slug uniqueness violations produce Postgres error code `23505` (unique_violation) on the `tenants_slug_key` constraint. Catch and return 409 `slug_taken`.

## Rejected alternatives

**Flat service paths (`/services/:id`):** Nesting under `/tenants/:tenantId/services` makes the authorization boundary explicit in the URL and avoids a join to verify ownership before setting RLS context.

**Pagination on list endpoints:** No requirement at MVP scale; bare arrays are sufficient. Add when needed.

**Overlap constraint in Postgres (`btree_gist` exclusion constraint):** Would require enabling the extension and a schema change. Application-layer validation is simpler, avoids a migration, and produces a cleaner error message.

**`PUT` instead of `PATCH`:** `PATCH` for partial updates is more ergonomic for the client; `PUT` would require sending the full object on every update.

## Trade-offs accepted

- No pagination — lists return all rows for the tenant.
- No filtering or sorting on list endpoints.
- No bulk operations — each service/rule is managed individually.

## Out of scope

- Bookings endpoints (M7)
- Adding or managing users within a tenant (post-MVP)
- Role-based access within a tenant (all users are admins, post-MVP)
- Soft delete
- Tenant-level data export or account transfer

## Edge cases

- Deleting a tenant that has services but no bookings: `services` cascade-delete; tenant deletes successfully.
- Updating a slug to its current value: Postgres does not raise a unique violation for a self-update (same row); no special handling needed.
- Availability rule update changing only `dayOfWeek` (not times): overlap check still runs on the merged result to catch conflicts on the new day.
- Service belonging to another tenant queried via the correct tenant path: return 404, not 403, to avoid leaking existence.
- `PATCH` with an empty body: return 422 with `details: ["at_least_one_field_required"]`.
