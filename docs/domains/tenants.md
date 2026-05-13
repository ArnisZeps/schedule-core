# Domain: Tenants

A tenant is a business account (e.g. a barber shop, clinic). Created at signup alongside the first owner user. Owners can update their name/slug or delete their account.

## Schema

Table: `tenants` — see [data-model.md](../db/data-model.md).

## API

All routes require `Authorization: Bearer <token>`. `req.auth.tenantId` must match `:tenantId` — 403 on mismatch. Return 404 if entity does not exist (do not leak existence across tenant boundaries).

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/tenants/[tenantId]/route.ts` | Tenant read / update / delete |

### `GET /api/tenants/:id`

**Response 200**
```json
{ "id": "uuid", "name": "string", "slug": "string", "createdAt": "iso8601" }
```

**Errors:** `403`, `404`

---

### `PATCH /api/tenants/:id`

All fields optional; at least one must be present.

**Request**
```json
{ "name": "string?", "slug": "string?" }
```

**Response 200** — updated tenant object (same shape as GET).

**Errors:** `403`, `404`, `409` `slug_taken`, `422` `validation_error`

---

### `DELETE /api/tenants/:id`

**Response 204**

**Errors:** `403`, `404`, `409` `has_bookings` — tenant has existing bookings (ON DELETE RESTRICT blocks deletion)

---

## Frontend

No dedicated tenant management UI in MVP. The owner's `tenantId` is read from the decoded JWT in `AuthContext`. Tenant settings (name/slug editing) is post-MVP.
