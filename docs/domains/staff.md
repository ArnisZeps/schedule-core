# Domain: Staff

Staff members who perform services for a tenant. Each staff member belongs to one location, can be assigned to specific services, has a recurring weekly schedule, and can have date-range overrides (days off, adjusted hours). `staff_schedules` and `staff_schedule_overrides` are the source of truth for slot generation.

## Schema

Tables: `staff`, `staff_services`, `staff_schedules`, `staff_schedule_overrides` — see [data-model.md](../db/data-model.md).

## API

All routes require `Authorization: Bearer <token>`. RLS context is set via `SET LOCAL app.current_tenant_id` inside each transaction.

### Staff CRUD

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/tenants/[tenantId]/staff/route.ts` | Staff list + create |
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/route.ts` | Staff read / update / delete |

```
GET    /api/tenants/:tenantId/staff             ?includeInactive=true&locationId=uuid
POST   /api/tenants/:tenantId/staff
GET    /api/tenants/:tenantId/staff/:staffId
PATCH  /api/tenants/:tenantId/staff/:staffId
DELETE /api/tenants/:tenantId/staff/:staffId
```

`GET` list returns only `is_active = true` by default; `?includeInactive=true` returns all. Optional `?locationId=uuid` filters by location.

`DELETE` permanently removes the staff member. All `staff_services`, `staff_schedules`, and `staff_schedule_overrides` rows cascade-delete. Returns 204.

Fetching a staff record from another tenant: RLS blocks the row; API returns 404.

**POST body**
```json
{ "name": "string", "email": "string (optional)", "phone": "string (optional)", "locationId": "uuid" }
```

**PATCH body** (all fields optional)
```json
{ "name": "string", "email": "string | null", "phone": "string | null", "isActive": "boolean", "locationId": "uuid" }
```

**Staff response shape**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "name": "string",
  "email": "string | null",
  "phone": "string | null",
  "isActive": "boolean",
  "locationId": "uuid",
  "createdAt": "iso8601"
}
```

---

### Service assignment

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/services/route.ts` | Service assignment list + replace |

```
GET /api/tenants/:tenantId/staff/:staffId/services
PUT /api/tenants/:tenantId/staff/:staffId/services
```

`PUT` body: `{ "serviceIds": ["uuid", ...] }` — replaces the full set in a single transaction (DELETE all, INSERT new). Empty array removes all assignments.

`GET` returns array of full service objects (same shape as `GET /api/tenants/:tenantId/services`).

---

### Schedules

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/schedules/route.ts` | Schedule list + replace |

```
GET /api/tenants/:tenantId/staff/:staffId/schedules
PUT /api/tenants/:tenantId/staff/:staffId/schedules
```

`PUT` body:
```json
{ "windows": [{ "dayOfWeek": 0, "startTime": "09:00", "endTime": "13:00" }] }
```

Replaces the full set. `dayOfWeek`: 0 = Sunday … 6 = Saturday. Empty array removes all windows.

`GET` response:
```json
[{ "id": "uuid", "dayOfWeek": 0, "startTime": "09:00", "endTime": "13:00" }]
```

Overlap validation is enforced client-side before PUT. The database has no overlap constraint.

---

### Overrides

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/overrides/route.ts` | Override list + create |
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/overrides/[overrideId]/route.ts` | Override update / delete |

```
GET    /api/tenants/:tenantId/staff/:staffId/overrides   ?from=YYYY-MM-DD&to=YYYY-MM-DD
POST   /api/tenants/:tenantId/staff/:staffId/overrides
PATCH  /api/tenants/:tenantId/staff/:staffId/overrides/:overrideId
DELETE /api/tenants/:tenantId/staff/:staffId/overrides/:overrideId
```

`GET` supports optional `from`/`to` date filters for calendar window fetching.

**POST/PATCH body**
```json
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "type": "available | not_available",
  "startTime": "HH:MM",
  "endTime": "HH:MM"
}
```

**Override response shape**
```json
{
  "id": "uuid",
  "staffId": "uuid",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "type": "available | not_available",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "createdAt": "iso8601"
}
```

**Errors:** `422` when `startDate > endDate`, or when `startDate === endDate` and `startTime >= endTime`. For multi-day overrides (`startDate < endDate`) any `startTime`/`endTime` combination is valid.

---

## Frontend

### Routes

| Route | File |
|-------|------|
| `/staff` | `apps/web/app/(dashboard)/staff/page.tsx` |
| `/staff/new` | `apps/web/app/(dashboard)/staff/new/page.tsx` |
| `/staff/:staffId` | `apps/web/app/(dashboard)/staff/[staffId]/page.tsx` |

### Hooks

```ts
// apps/web/src/hooks/useStaff.ts

// Staff CRUD
function useStaffList(includeInactive?: boolean): UseQueryResult<Staff[]>
function useStaff(staffId: string): UseQueryResult<Staff>
function useCreateStaff(): UseMutationResult<Staff, ApiError, CreateStaffInput>
function useUpdateStaff(): UseMutationResult<Staff, ApiError, { staffId: string } & UpdateStaffInput>
function useDeleteStaff(): UseMutationResult<void, ApiError, { staffId: string }>

// Service assignment
function useStaffServices(staffId: string): UseQueryResult<Service[]>
function useUpdateStaffServices(): UseMutationResult<Service[], ApiError, { staffId: string; serviceIds: string[] }>

// Schedules
function useStaffSchedules(staffId: string): UseQueryResult<ScheduleWindow[]>
function useUpdateStaffSchedules(): UseMutationResult<ScheduleWindow[], ApiError, { staffId: string; windows: ScheduleWindowInput[] }>

// Overrides
function useStaffOverrides(staffId: string, from?: string, to?: string): UseQueryResult<ScheduleOverride[]>
function useCreateStaffOverride(): UseMutationResult<ScheduleOverride, ApiError, { staffId: string } & OverrideInput>
function useUpdateStaffOverride(): UseMutationResult<ScheduleOverride, ApiError, { staffId: string; overrideId: string } & OverrideInput>
function useDeleteStaffOverride(): UseMutationResult<void, ApiError, { staffId: string; overrideId: string }>

// Used by the booking manual entry panel (see bookings.md)
function useServiceStaff(serviceId: string | null, locationId: string | null): UseQueryResult<Staff[]>

interface Staff {
  id: string; tenantId: string; name: string
  email: string | null; phone: string | null
  isActive: boolean; locationId: string; createdAt: string
}

interface ScheduleWindow { id: string; dayOfWeek: number; startTime: string; endTime: string }
interface ScheduleWindowInput { dayOfWeek: number; startTime: string; endTime: string }

interface ScheduleOverride {
  id: string; staffId: string
  startDate: string; endDate: string
  type: 'available' | 'not_available'
  startTime: string; endTime: string; createdAt: string
}
```

### Key components

| File | Responsibility |
|------|----------------|
| `apps/web/src/page-components/staff/StaffListPage.tsx` | List with active/inactive toggle and create entry point |
| `apps/web/src/page-components/staff/StaffDetailPage.tsx` | Profile edit, deactivate/reactivate; hosts Services, Schedule, Overrides sections |
| `apps/web/src/components/staff/StaffForm.tsx` | Name/email/phone/location form for create and edit |
| `apps/web/src/components/staff/ServiceAssignment.tsx` | Service checkbox list with save button |
| `apps/web/src/components/staff/WeeklyScheduleCalendar.tsx` | 7-column weekday calendar; drag to paint time windows; client-side overlap check before PUT |
| `apps/web/src/components/staff/WeekdayColumn.tsx` | Single day column with drag gesture and window blocks |
| `apps/web/src/components/staff/ScheduleWindowPanel.tsx` | Slide-over: day picker, start/end time, create/update/delete |
| `apps/web/src/components/staff/OverrideCalendar.tsx` | Week/day view calendar for overrides with toolbar; multi-day overrides render on every covered day |
| `apps/web/src/components/staff/OverrideBlock.tsx` | Coloured block (green = available, red = not_available) |
| `apps/web/src/components/staff/OverridePanel.tsx` | Slide-over: date range, type toggle, start/end time |
| `apps/web/src/components/ui/TimeSelect.tsx` | 24-hour time picker (two `<select>` elements: hour 00–23, minute 00–55 in 5-min steps); emits HH:MM string; used in `ScheduleWindowPanel` and `OverridePanel` |

### Schedule drag protocol

`WeekdayColumn`: `mousedown` on column → start drag; `mousemove` → ghost block; `mouseup` → snap to 15-min grid → `onTimeSelect(startTime, endTime)`. `WeeklyScheduleCalendar` opens `ScheduleWindowPanel` with times pre-filled. Each panel action (create/update/delete) calls `PUT /schedules` with the full updated window list — no separate Save button. Clicking an existing block opens `ScheduleWindowPanel` in edit mode.

### Override drag protocol

`OverrideCalendar` day columns: same 15-min snap drag pattern → `mouseup` → `onTimeSelect(date, startTime, endTime)` → opens `OverridePanel` pre-filled with date and times. Type has no default — owner must select. Clicking an existing `OverrideBlock` opens `OverridePanel` in edit mode.

## Override semantics

A `not_available` or `available` override is interpreted as a **continuous time range** from `startDate + startTime` through `endDate + endTime`:

| Date position | Blocked/added window |
|---------------|----------------------|
| `startDate` | `startTime → 24:00` |
| intermediate day (`startDate < date < endDate`) | `00:00 → 24:00` (full day) |
| `endDate` | `00:00 → endTime` |
| single-day (`startDate === endDate`) | `startTime → endTime` (unchanged) |

This means an override from Monday 09:00 to Friday 17:00 keeps Monday before 09:00 and Friday after 17:00 available, and fully blocks Tuesday–Thursday. Implemented in `apps/web/src/lib/server/availability.ts` via `clipOverrideWindow` (`apps/web/src/lib/overrideClip.ts`).

## Constraints

- `location_id` is required on `staff` (non-nullable). Each staff member belongs to exactly one location.
- Schedule overlap validation is client-side only — no DB constraint on `staff_schedules`.
- Overlapping overrides are stored without error; the Bookings domain defines availability precedence during slot generation.
- Deactivating staff with future bookings is allowed without warning in MVP.
