# Domain: Locations

Physical or logical business locations (e.g. "Main Street Branch", "Old Town"). Every staff member and every booking belongs to exactly one location. Single-location tenants see no location UI — the choice is handled transparently in affected components.

## Schema

Table: `locations` — see [data-model.md](../db/data-model.md).

## API

All routes require the `sc_token` HttpOnly cookie (read by `withAuth.ts`). RLS context is set via `SET LOCAL app.current_tenant_id` inside each transaction.

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/tenants/[tenantId]/locations/route.ts` | Location list + create |
| `apps/web/app/api/tenants/[tenantId]/locations/[locationId]/route.ts` | Location read / update / delete |

```
GET    /api/tenants/:tenantId/locations             ?includeInactive=true
POST   /api/tenants/:tenantId/locations
GET    /api/tenants/:tenantId/locations/:locationId
PATCH  /api/tenants/:tenantId/locations/:locationId
DELETE /api/tenants/:tenantId/locations/:locationId
```

`GET` list returns only `is_active = true` by default; `?includeInactive=true` returns all.

`DELETE` returns 204. Returns 409 when `staff.location_id` or `bookings.location_id` FK RESTRICT blocks deletion — handler catches Postgres error `23503` and returns:
```json
{ "error": "Reassign all staff and ensure no bookings reference this location before deleting." }
```

**POST body**
```json
{ "name": "string", "address": "string (optional)", "timezone": "string (IANA name)" }
```

**PATCH body** (all optional)
```json
{ "name": "string", "address": "string | null", "timezone": "string", "isActive": "boolean" }
```

**Location response shape**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "name": "string",
  "address": "string | null",
  "timezone": "string",
  "isActive": "boolean",
  "createdAt": "iso8601"
}
```

---

## Frontend

### Routes

| Route | File |
|-------|------|
| `/locations` | `apps/web/app/(dashboard)/locations/page.tsx` — async Server Component; pre-fetches active locations and passes as `initialLocations` to `LocationListPage` |
| `/locations/new` | `apps/web/app/(dashboard)/locations/new/page.tsx` |
| `/locations/:locationId` | `apps/web/app/(dashboard)/locations/[locationId]/page.tsx` |

`locations/page.tsx` reads `x-tenant-id` from headers injected by middleware, queries active locations via `withTenantContext`, and passes the result as `initialData` to React Query in `LocationListPage`. This eliminates the loading skeleton on first render. When the user toggles "Show deactivated", `useLocations(true)` issues a separate network fetch (no SSR initial data for that variant).

### Hooks

```ts
// apps/web/src/hooks/useLocations.ts
function useLocations(includeInactive?: boolean, initialData?: Location[]): UseQueryResult<Location[]>
function useLocation(locationId: string): UseQueryResult<Location>
function useCreateLocation(): UseMutationResult<Location, ApiError, CreateLocationInput>
function useUpdateLocation(): UseMutationResult<Location, ApiError, { locationId: string } & UpdateLocationInput>
function useDeleteLocation(): UseMutationResult<void, ApiError, { locationId: string }>

interface Location {
  id: string; tenantId: string; name: string
  address: string | null; timezone: string
  isActive: boolean; createdAt: string
}

interface CreateLocationInput { name: string; address?: string; timezone: string }
interface UpdateLocationInput { name?: string; address?: string | null; timezone?: string; isActive?: boolean }
```

### Key components

| File | Responsibility |
|------|----------------|
| `apps/web/src/page-components/locations/LocationListPage.tsx` | List with is_active toggle and create entry point |
| `apps/web/src/page-components/locations/LocationDetailPage.tsx` | Edit name/address; deactivate/reactivate; danger zone |
| `apps/web/src/components/locations/LocationForm.tsx` | Name and address fields. Timezone is auto-detected from the browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and submitted transparently — it is not shown to the user. |

### Single-location transparency

Components that need a location selection (`StaffForm`, `NewAppointmentPanel`) call `useLocations()` on mount:

- `locations.length === 1`: pre-select that location; hide the picker from the DOM.
- `locations.length > 1`: show the dropdown; no default; validation requires a selection.

This is a client-side derived condition — no server flag.

## Constraints

- `timezone` is a free-text IANA string (e.g. `Europe/Riga`). Validated against `Intl.supportedValuesOf('timeZone')` at the API layer.
- Every tenant has at least one location — seeded at first migration.
- `location_id` on `staff` and `bookings` is non-nullable with FK RESTRICT — location cannot be deleted while it has staff or bookings.
- Deactivating the last active location is API-allowed but will prevent booking creation until reactivated.
