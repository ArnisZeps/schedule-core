# Domain: Services

Bookable services within a tenant (e.g. haircut, consultation, massage). Owners manage services via the dashboard. `duration_minutes` drives slot generation in the Bookings domain. Services are tenant-wide — not scoped per location. Availability is per-staff via the Staff domain (`availability_rules` was dropped).

## Schema

Table: `services` — see [data-model.md](../db/data-model.md).

## API

All routes require the `sc_token` HttpOnly cookie (read by `withAuth.ts`). Authorization rule: `req.auth.tenantId === :tenantId` → 403. Service not found or belonging to another tenant → 404.

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/tenants/[tenantId]/services/route.ts` | Service list + create |
| `apps/web/app/api/tenants/[tenantId]/services/[serviceId]/route.ts` | Service read / update / delete |

### `POST /api/tenants/:tenantId/services`

**Request**
```json
{ "name": "string", "description": "string?", "durationMinutes": "integer (optional, default 30)" }
```

**Response 201**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "name": "string",
  "description": "string | null",
  "durationMinutes": "integer",
  "createdAt": "iso8601"
}
```

**Errors:** `403`, `422`

---

### `GET /api/tenants/:tenantId/services`

**Response 200** — array of service objects (same shape as POST 201).

**Errors:** `403`

---

### `GET /api/tenants/:tenantId/services/:id`

**Response 200** — single service object.

**Errors:** `403`, `404`

---

### `PATCH /api/tenants/:tenantId/services/:id`

All fields optional; at least one must be present. Pass `null` for `description` to clear it.

**Request**
```json
{ "name": "string?", "description": "string | null?", "durationMinutes": "integer?" }
```

**Response 200** — updated service object.

**Errors:** `403`, `404`, `422`

---

### `DELETE /api/tenants/:tenantId/services/:id`

**Response 204**

**Errors:** `403`, `404`, `409` `has_bookings` (ON DELETE RESTRICT)

`staff_services` rows cascade-delete automatically when a service is deleted.

---

## Frontend

### Routes

| Route | File |
|-------|------|
| `/services` | `apps/web/app/(dashboard)/services/page.tsx` — async Server Component; pre-fetches service list and passes as `initialServices` to `ServiceListPage` |
| `/services/new` | `apps/web/app/(dashboard)/services/new/page.tsx` |
| `/services/:serviceId` | `apps/web/app/(dashboard)/services/[serviceId]/page.tsx` |

`services/page.tsx` reads `x-tenant-id` from headers injected by middleware, queries the DB via `withTenantContext`, and passes the result as `initialData` to React Query in `ServiceListPage`. This eliminates the loading skeleton on first render.

### Hooks

```ts
// apps/web/src/hooks/useServices.ts
function useServices(initialData?: Service[]): UseQueryResult<Service[]>
function useCreateService(): UseMutationResult<Service, ApiError, CreateServiceInput>
function useUpdateService(): UseMutationResult<Service, ApiError, { serviceId: string } & UpdateServiceInput>
function useDeleteService(): UseMutationResult<void, ApiError, { serviceId: string }>

// apps/web/src/hooks/useService.ts
function useService(serviceId: string): UseQueryResult<Service>

interface Service {
  id: string
  tenantId: string
  name: string
  description: string | null
  durationMinutes: number
  createdAt: string
}
```

### Key components

| File | Responsibility |
|------|----------------|
| `apps/web/src/page-components/services/ServiceListPage.tsx` | Table: name, description, actions menu (edit / delete). Description is truncated to a single line (`max-w-lg truncate`) with the full text in a native `title` tooltip, so long descriptions never push the actions column off-screen. Null description shows `—`. |
| `apps/web/src/page-components/ServiceFormPage.tsx` | Create and edit in one component |

## Constraints

- `availability_rules` table was dropped — no availability rule endpoints exist. All availability is configured per staff member (see [staff.md](staff.md)).
- Services are tenant-wide, not per-location.
- Deleting a service with active bookings is blocked by FK RESTRICT. `staff_services` rows cascade-delete cleanly.
