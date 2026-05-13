# Design: m6c-locations

## Problem

After M6b, staff exist but have no concept of where they work. The `bookings` table has no
location field. ScheduleCore serves businesses with multiple branches (a barbershop chain,
a clinic with several sites); without locations, appointments cannot be scoped or filtered by
branch, and M7's public booking widget has no "pick a location" step to build on.

This milestone introduces `locations` as a first-class entity, assigns each staff member to
exactly one location, attaches a location to every booking, and lays the data-model foundation
M7 needs. Single-location tenants see no friction — the migration seeds a default location and
the UI hides location controls when only one exists.

Constraints:
- Raw SQL, no ORM (ADR-004). shadcn/ui (ADR-009).
- `tenant_id` denormalised on all new tables for RLS (ADR-005).
- Slot generation continues to use `availability_rules` — the cutover to staff schedules
  is M6d. This milestone only records which location a booking belongs to.
- No new infrastructure dependencies.

## Components

### New files

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/tenants/[tenantId]/locations/route.ts` | Location list (GET) and create (POST) |
| `apps/web/app/api/tenants/[tenantId]/locations/[locationId]/route.ts` | Location read/update/delete |
| `apps/web/src/page-components/locations/LocationListPage.tsx` | List with is_active toggle and create entry point |
| `apps/web/src/page-components/locations/LocationDetailPage.tsx` | Edit name/address/timezone, deactivate/reactivate, danger zone |
| `apps/web/src/components/locations/LocationForm.tsx` | Name, address, timezone fields |
| `apps/web/src/hooks/useLocations.ts` | All location queries and mutations |
| `apps/web/app/(dashboard)/locations/page.tsx` | Locations list route |
| `apps/web/app/(dashboard)/locations/new/page.tsx` | Location create route |
| `apps/web/app/(dashboard)/locations/[locationId]/page.tsx` | Location detail route |
| `packages/db/migrations/0006_m6c_locations.sql` | Schema, seed, and backfill |

### Modified files

| File | Change |
|------|--------|
| `apps/web/src/components/layout/Sidebar.tsx` | Add "Locations" nav entry |
| `apps/web/src/components/staff/StaffForm.tsx` | Add location dropdown (pre-selected for single-location tenants) |
| `apps/web/src/page-components/staff/StaffDetailPage.tsx` | Location shown in profile section |
| `apps/web/src/page-components/staff/StaffListPage.tsx` | Location filter dropdown (hidden for single-location tenants) |
| `apps/web/app/api/tenants/[tenantId]/staff/route.ts` | Add `?locationId` filter to GET; add `locationId` to POST body and response |
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/route.ts` | Add `locationId` to PATCH body and response |
| `apps/web/app/api/tenants/[tenantId]/bookings/route.ts` | Add `locationId` to POST body (required) and response |
| `apps/web/app/api/public/[tenantSlug]/bookings/route.ts` | Auto-resolve location for single-location tenants; 422 for multi-location |
| `apps/web/src/components/calendar/NewAppointmentPanel.tsx` | Add location selector (hidden for single-location tenants) |
| `apps/web/src/hooks/useStaff.ts` | Add `locationId` to `Staff` type and mutation inputs |
| `apps/web/src/hooks/useBookings.ts` | Add `locationId` to `Booking` type |
| `docs/db/data-model.md` | Document `locations` table and new columns on `staff` and `bookings` |

## Contracts

### Migration — `0006_m6c_locations.sql`

```sql
-- 1. Create locations table
CREATE TABLE locations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  address    TEXT,
  timezone   TEXT        NOT NULL DEFAULT 'UTC',
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON locations (tenant_id);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY locations_tenant_isolation ON locations
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- 2. Seed a default location per tenant BEFORE FORCE ROW LEVEL SECURITY.
--    FORCE is not yet applied, so this INSERT runs as the table owner without
--    needing app.current_tenant_id to be set.
INSERT INTO locations (tenant_id, name, timezone)
SELECT id, name, 'UTC'
FROM tenants;

ALTER TABLE locations FORCE ROW LEVEL SECURITY;

-- 3. Add location_id to staff (nullable first for backfill).
ALTER TABLE staff ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE RESTRICT;

-- Backfill: staff.location_id → the default location seeded for that tenant.
-- Runs inside a DO block so app.current_tenant_id is set per tenant, satisfying
-- RLS on the staff table (which already has FORCE ROW LEVEL SECURITY from M6b).
DO $$
DECLARE
  t      RECORD;
  loc_id UUID;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.current_tenant_id', t.id::text, true);
    SELECT id INTO loc_id FROM locations WHERE tenant_id = t.id LIMIT 1;
    UPDATE staff SET location_id = loc_id WHERE tenant_id = t.id;
  END LOOP;
END;
$$;

ALTER TABLE staff ALTER COLUMN location_id SET NOT NULL;
CREATE INDEX ON staff (location_id);

-- 4. Add location_id to bookings (nullable first for backfill).
ALTER TABLE bookings ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE RESTRICT;

DO $$
DECLARE
  t      RECORD;
  loc_id UUID;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.current_tenant_id', t.id::text, true);
    SELECT id INTO loc_id FROM locations WHERE tenant_id = t.id LIMIT 1;
    UPDATE bookings SET location_id = loc_id WHERE tenant_id = t.id;
  END LOOP;
END;
$$;

ALTER TABLE bookings ALTER COLUMN location_id SET NOT NULL;
CREATE INDEX ON bookings (location_id);
```

### API — Locations

All routes are behind `requireAuth` + `requireTenantMatch`. RLS context is set via
`SET LOCAL app.current_tenant_id` inside each transaction.

```
GET    /tenants/:tenantId/locations               ?includeInactive=true
POST   /tenants/:tenantId/locations
GET    /tenants/:tenantId/locations/:locationId
PATCH  /tenants/:tenantId/locations/:locationId
DELETE /tenants/:tenantId/locations/:locationId
```

`GET` list returns only `is_active = true` by default; `?includeInactive=true` returns all.

`DELETE` returns 204 on success. Returns 409 when `staff.location_id` or
`bookings.location_id` FK RESTRICT blocks deletion (Postgres error code `23503`).
The handler catches this error and returns `{ error: "Reassign all staff and ensure no bookings reference this location before deleting." }`.

POST body:
```json
{ "name": "string", "address": "string (optional)", "timezone": "string" }
```

PATCH body (all optional):
```json
{ "name": "string", "address": "string | null", "timezone": "string", "isActive": "boolean" }
```

Location response shape:
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "name": "string",
  "address": "string | null",
  "timezone": "string",
  "isActive": true,
  "createdAt": "iso8601"
}
```

### API — Staff changes

`GET /tenants/:tenantId/staff` adds an optional `?locationId=uuid` query parameter.
When provided, the SQL WHERE clause gains `AND location_id = $n`.

POST body gains `locationId` (required):
```json
{ "name": "string", "email": "string (optional)", "phone": "string (optional)", "locationId": "uuid" }
```

PATCH body gains `locationId` (optional):
```json
{ "name": "string", "email": "string|null", "phone": "string|null", "isActive": "boolean", "locationId": "uuid" }
```

Staff response shape gains:
```json
{ ..., "locationId": "uuid" }
```

### API — Bookings changes

`POST /tenants/:tenantId/bookings` body gains `locationId` (required):
```json
{
  "serviceId": "uuid",
  "locationId": "uuid",
  "clientName": "string",
  "clientPhone": "string",
  "clientEmail": "string (optional)",
  "startAt": "iso8601",
  "endAt": "iso8601",
  "notes": "string (optional)",
  "override": false
}
```

Bookings response shape gains:
```json
{ ..., "locationId": "uuid" }
```

`POST /public/:tenantSlug/bookings`: the handler fetches active locations for the tenant.
If exactly one active location exists, `locationId` is set to it automatically (no change to
the public request body). If more than one active location exists, the endpoint returns 422:
```json
{ "error": "This business has multiple locations. Use the booking widget to select a location." }
```

### Hook interfaces

```ts
// Locations
function useLocations(includeInactive?: boolean): UseQueryResult<Location[]>
function useLocation(locationId: string): UseQueryResult<Location>
function useCreateLocation(): UseMutationResult<Location, ApiError, CreateLocationInput>
function useUpdateLocation(): UseMutationResult<Location, ApiError, { locationId: string } & UpdateLocationInput>
function useDeleteLocation(): UseMutationResult<void, ApiError, { locationId: string }>

interface Location {
  id: string;
  tenantId: string;
  name: string;
  address: string | null;
  timezone: string;
  isActive: boolean;
  createdAt: string;
}

interface CreateLocationInput {
  name: string;
  address?: string;
  timezone: string;
}

interface UpdateLocationInput {
  name?: string;
  address?: string | null;
  timezone?: string;
  isActive?: boolean;
}

// Updated Staff type
interface Staff {
  // ... existing fields ...
  locationId: string;
}

// Updated Booking type
interface Booking {
  // ... existing fields ...
  locationId: string;
}
```

### Single-location transparency

Both `StaffForm` and `NewAppointmentPanel` call `useLocations()` on mount.

- If `locations.length === 1`: pre-select that location; hide the picker from the DOM.
- If `locations.length > 1`: show the dropdown; no default; validation requires a selection.

This is a client-side derived condition — no server flag needed.

## Rejected alternatives

**Nullable `location_id` on `bookings` permanently** — rejected because it creates a
two-class system (old bookings vs new bookings) and makes filtering by location unreliable.
Backfilling to a default location during the migration gives all rows a valid FK and allows
NOT NULL.

**Separate `location_id` column on `availability_rules`** — rejected. Availability rules are
service-level and remain unchanged until M6d. Attaching location to availability rules before
staff schedules drive slot generation would create an orphaned column with no query consumers.

**Timezone as a UTC offset integer** — rejected. Offsets don't handle daylight-saving time.
IANA names (e.g. `Europe/Riga`) are the standard and Postgres's `AT TIME ZONE` operator
accepts them natively. Display formatting with IANA names is also trivially handled by the
browser's `Intl.DateTimeFormat`.

**A "default location" flag on the locations row** — rejected. The UI derives single-location
status from `locations.length === 1`. A flag adds a writeable invariant (exactly one must be
true) with no benefit at the scale of the MVP.

**Hard-delete with cascading bookings nullification** — rejected. Losing location on historical
bookings destroys audit trail. RESTRICT FK forces the owner to consciously reassign staff and
prevents silent data loss.

**Location picker in M7 public flow without grounding it in M6c** — not relevant to reject;
M7 depends on this data model. M6c is the prerequisite.

## Trade-offs accepted

- Timezone is stored as a free-text IANA string. Server-side validation uses a
  known-IANA-zones allowlist (or a lightweight IANA check via `Intl.supportedValuesOf('timeZone')`
  in Node). A full timezone picker UI widget is not introduced — a text input with validation
  is adequate for MVP.
- The `bookings.location_id` backfill uses the first location row for the tenant. All
  pre-existing tenants have exactly one seeded location, so "first" is deterministic.
- Slot generation (`GET /services/:serviceId/slots`) is not location-aware in M6c.
  The slot grid in `NewAppointmentPanel` continues to use `availability_rules`. Location is
  recorded on the booking but does not filter available times until M6d.
- Deactivating a location with currently assigned staff is allowed without warning in MVP.
  Staff remain assigned to the inactive location; owners must reassign them manually.
- The public endpoint returns 422 for multi-location tenants instead of showing a degraded
  default. This is intentional: a silently wrong location on a booking is worse than a clear error.

## Out of scope

- Location-aware slot generation (M6d, when staff schedules drive availability).
- Client-facing location picker in the public booking widget (M7).
- Multiple locations per staff member.
- Per-location services (services remain tenant-wide).
- Location photos or branding.
- Map or geocoding integration.
- Per-location working hours (future; currently modelled per-staff via `staff_schedules`).

## Edge cases

| Scenario | Handling |
|----------|----------|
| Tenant has no active locations | `NewAppointmentPanel` cannot submit (no location to assign). Staff create form also blocked. Edge case only during an incomplete migration; the migration always seeds one location. |
| DELETE location with staff | FK RESTRICT raises Postgres error 23503; handler returns 409 with a descriptive message. |
| DELETE location with bookings | Same as above — both staff and bookings FKs are RESTRICT. |
| PATCH `isActive: false` on the tenant's only location | Allowed by the API. The UI does not prevent this, but booking creation will subsequently fail for that tenant until a new active location exists or the location is reactivated. |
| Staff PATCH changes `locationId` to a location from another tenant | RLS on `locations` blocks the fetch; the location row is invisible. The handler returns 404. |
| `NewAppointmentPanel` fetches locations while none are active | Panel shows an error state; submit button is disabled. |
| Public booking on a multi-location tenant | Returns 422 until M7 adds the location step to the widget. |
| Backfill on a tenant with no staff or bookings | UPDATE affects 0 rows — valid, no error. |
