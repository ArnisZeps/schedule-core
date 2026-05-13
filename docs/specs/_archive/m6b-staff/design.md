# Design: m6b-staff

## Problem

ScheduleCore currently has no staff entity. Availability is modelled at the service level
(`availability_rules`), and bookings carry no reference to who performs the appointment.
This milestone introduces staff as a first-class entity with two distinct calendar-based UIs:

1. A **weekday calendar** (Mon–Sun, no dates) for managing the recurring weekly schedule —
   drag to paint time windows, click to edit or delete.
2. A **date calendar** (week/day view with actual dates) for managing one-off overrides —
   drag or button to create, click block to edit, green/red colour-coding for
   available/not-available.

Staff availability (`staff_schedules`) is the intended long-term source of truth, replacing
service-level `availability_rules`. The slot-generation logic and booking flow are not changed
here — that wiring is M6d. The `availability_rules` table and its API endpoints remain
operational until M6d performs the cutover.

Constraints:
- Raw SQL, no ORM (ADR-004). shadcn/ui (ADR-009).
- `tenant_id` denormalised on all new tables for RLS (ADR-005).
- No new infrastructure dependencies.

## Components

### New files

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/tenants/[tenantId]/staff/route.ts` | Staff list + create handlers |
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/route.ts` | Staff read/update/delete handlers |
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/services/route.ts` | Staff service assignment handlers |
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/schedules/route.ts` | Staff schedule CRUD handlers |
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/overrides/route.ts` | Staff override list + create handlers |
| `apps/web/app/api/tenants/[tenantId]/staff/[staffId]/overrides/[overrideId]/route.ts` | Staff override update/delete handlers |
| `apps/web/src/page-components/staff/StaffListPage.tsx` | List of staff with active/inactive toggle and create entry point |
| `apps/web/src/page-components/staff/StaffDetailPage.tsx` | Profile edit, deactivate/reactivate; hosts Services, Schedule, Overrides sections |
| `apps/web/src/components/staff/StaffForm.tsx` | Name/email/phone form used for create and profile edit |
| `apps/web/src/components/staff/ServiceAssignment.tsx` | Service checkbox list with save button |
| `apps/web/src/components/staff/WeeklyScheduleCalendar.tsx` | 7-column weekday calendar; owns drag state and pending-change list |
| `apps/web/src/components/staff/WeekdayColumn.tsx` | Single day column with drag gesture, ghost block, and window blocks; delegates editing to `ScheduleWindowPanel` |
| `apps/web/src/components/staff/ScheduleWindowPanel.tsx` | Slide-over panel for creating and editing schedule windows: day picker (create mode), start/end time, create/update/delete |
| `apps/web/src/components/staff/OverrideCalendar.tsx` | Week/day view calendar for overrides; toolbar with view toggle, navigation, create button |
| `apps/web/src/components/staff/OverrideBlock.tsx` | Coloured block rendered on the override calendar (green / red) |
| `apps/web/src/components/staff/OverridePanel.tsx` | Slide-over panel for create/edit: date range, type toggle, start/end time |
| `apps/web/src/hooks/useStaff.ts` | All staff-related queries and mutations |
| `packages/db/migrations/0005_m6b_staff.sql` | Schema: four new tables |

### Modified files

| File | Change |
|------|--------|
| `apps/web/src/components/layout/Sidebar.tsx` | Add "Staff" nav entry linking to `/staff` |
| `apps/web/app/(dashboard)/staff/page.tsx` | Staff list route |
| `apps/web/app/(dashboard)/staff/new/page.tsx` | Staff create route |
| `apps/web/app/(dashboard)/staff/[staffId]/page.tsx` | Staff detail route |
| `docs/db/data-model.md` | Document the four new tables |

## Contracts

### Migration — `0005_m6b_staff.sql`

```sql
CREATE TABLE staff (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  email      TEXT,
  phone      TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON staff (tenant_id);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_tenant_isolation ON staff
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE staff FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------

CREATE TABLE staff_services (
  staff_id   UUID NOT NULL REFERENCES staff(id)    ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);

CREATE INDEX ON staff_services (tenant_id);

ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_services_tenant_isolation ON staff_services
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE staff_services FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------

CREATE TABLE staff_schedules (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID      NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  tenant_id   UUID      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week SMALLINT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME      NOT NULL,
  end_time    TIME      NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_time < end_time)
);

CREATE INDEX ON staff_schedules (staff_id);
CREATE INDEX ON staff_schedules (tenant_id);

ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_schedules_tenant_isolation ON staff_schedules
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE staff_schedules FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------

CREATE TABLE staff_schedule_overrides (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_date DATE        NOT NULL,
  end_date   DATE        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('available', 'not_available')),
  start_time TIME        NOT NULL,
  end_time   TIME        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_date <= end_date),
  CHECK (start_time < end_time)
);

CREATE INDEX ON staff_schedule_overrides (staff_id);
CREATE INDEX ON staff_schedule_overrides (tenant_id);
CREATE INDEX ON staff_schedule_overrides (staff_id, start_date, end_date);

ALTER TABLE staff_schedule_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_schedule_overrides_tenant_isolation ON staff_schedule_overrides
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE staff_schedule_overrides FORCE ROW LEVEL SECURITY;
```

### API endpoints

All routes are mounted under the existing `requireAuth` + `requireTenantMatch` middleware.
RLS context is set inside each transaction via `SET LOCAL app.current_tenant_id`.

**Staff CRUD**

```
GET    /tenants/:tenantId/staff                ?includeInactive=true
POST   /tenants/:tenantId/staff
GET    /tenants/:tenantId/staff/:staffId
PATCH  /tenants/:tenantId/staff/:staffId
DELETE /tenants/:tenantId/staff/:staffId
```

`DELETE` permanently removes the staff member row. All related rows in `staff_services`, `staff_schedules`, and `staff_schedule_overrides` are removed via `ON DELETE CASCADE`. Returns 204 No Content.

`GET` list returns only `is_active = true` by default; `?includeInactive=true` returns all.

POST body:
```json
{ "name": "string", "email": "string (optional)", "phone": "string (optional)" }
```

PATCH body (all fields optional):
```json
{ "name": "string", "email": "string|null", "phone": "string|null", "isActive": "boolean" }
```

Staff response shape:
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "name": "string",
  "email": "string | null",
  "phone": "string | null",
  "isActive": true,
  "createdAt": "iso8601"
}
```

**Service assignment**

```
GET /tenants/:tenantId/staff/:staffId/services
PUT /tenants/:tenantId/staff/:staffId/services
```

PUT body: `{ "serviceIds": ["uuid", ...] }` — replaces the full set in a single transaction
(DELETE all existing rows for the staff member, INSERT new set). Empty array removes all assignments.

GET returns array of full service objects (same shape as `GET /tenants/:tenantId/services`).

**Schedules**

```
GET /tenants/:tenantId/staff/:staffId/schedules
PUT /tenants/:tenantId/staff/:staffId/schedules
```

PUT body:
```json
{
  "windows": [{ "dayOfWeek": 0, "startTime": "09:00", "endTime": "13:00" }]
}
```

Replaces the full set (DELETE all rows for the staff member, INSERT new set). Empty array removes all windows.

GET response:
```json
[{ "id": "uuid", "dayOfWeek": 0, "startTime": "09:00", "endTime": "13:00" }]
```

**Overrides**

```
GET    /tenants/:tenantId/staff/:staffId/overrides   ?from=YYYY-MM-DD&to=YYYY-MM-DD
POST   /tenants/:tenantId/staff/:staffId/overrides
PATCH  /tenants/:tenantId/staff/:staffId/overrides/:overrideId
DELETE /tenants/:tenantId/staff/:staffId/overrides/:overrideId
```

GET supports optional `from`/`to` date filters for calendar window fetching.

POST/PATCH body:
```json
{
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "type": "available | not_available",
  "startTime": "HH:MM",
  "endTime": "HH:MM"
}
```

422 when `startTime >= endTime` or `startDate > endDate`.

Override response shape:
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

### Weekday calendar drag protocol

`WeekdayColumn` receives:

```ts
onTimeSelect: (startTime: string, endTime: string) => void
onBlockClick: (window: LocalWindow) => void
```

- `mousedown` on the column container (not on an existing block): start drag.
- `mousemove`: render a ghost `div` spanning drag start to current position (same pattern as `DayColumn` in the appointments page).
- `mouseup`: compute snapped start/end (15-min grid), call `onTimeSelect` and clear drag state.
- `WeeklyScheduleCalendar` opens `ScheduleWindowPanel` with the column's `dayOfWeek` pre-selected and the dragged times pre-filled.
- A "Create schedule" button in the calendar toolbar opens `ScheduleWindowPanel` with all fields blank (user picks day from a select).
- Clicking an existing block calls `onBlockClick`; `WeeklyScheduleCalendar` opens `ScheduleWindowPanel` in edit mode.
- Each panel action (create / update / delete) immediately calls `PUT /schedules` with the full updated window list — no separate "Save schedule" button.
- Overlap check: before adding or updating a window, `WeeklyScheduleCalendar` checks for same-day time overlap. If detected, a toast error is shown and the panel stays open; PUT is not called.

### Override calendar drag protocol

`OverrideCalendar` day columns receive:

```ts
onTimeSelect: (date: string, startTime: string, endTime: string) => void
```

- Same drag pattern as `DayColumn` (appointments page): 15-min snap, ghost block, mousedown/mousemove/mouseup.
- `mouseup` calls `onTimeSelect`; `OverrideCalendar` opens `OverridePanel` with `prefillDate`, `prefillStartTime`, `prefillEndTime` props.
- `OverridePanel` initialises `startDate = endDate = prefillDate`; `startTime = prefillStartTime`; `endTime = prefillEndTime`. Type has no default — owner must select.
- "Create override" button opens `OverridePanel` with no props (all fields blank).
- Clicking an existing `OverrideBlock` opens `OverridePanel` in edit mode, pre-filled from the override object.

### Hook interfaces

```ts
// Staff
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
```

## Rejected alternatives

**Form-based schedule editor** — a table with a row per day of the week and text inputs for
start/end times per row. Rejected: split shifts (multiple windows per day) make the row model
ambiguous, and the form becomes a cluttered spreadsheet. The drag calendar is faster and
visually maps to the owner's mental model of a work week.

**Form-based override list** — a chronological list with inline create/edit forms. Rejected:
hard to see gaps, conflicts, or patterns. A calendar immediately shows which dates are blocked
or changed; coloured blocks give instant status at a glance without parsing text.

**Separate "full day off" checkbox** — original design used `full_day_off: boolean` with
nullable times. Rejected: forces a two-branch UX (checkbox on/off, times appear/disappear).
Always requiring times is more consistent — a full day off is just the full working hours range,
which the owner knows without a special flag.

**Single `date` column with unique constraint** — the original override schema used one row per
date. Rejected: a holiday week would require 5–7 separate creates. Date ranges are more natural
and reduce data entry.

**Individual schedule row CRUD (POST/PATCH/DELETE per window)** — more granular, but requires
the client to track row IDs and reconcile server state after each edit. PUT-replace aligns with
the "paint the full week and save" mental model of the weekday calendar.

**Staff as users** — extending the `users` table so staff can log in. Rejected: staff don't
need system access in MVP; keeping a separate `staff` table preserves the auth boundary.

## Trade-offs accepted

- `availability_rules` and `GET /:id/slots` continue to drive slot generation after M6b. Staff
  schedules are managed but have no effect on booking validation until M6d performs the cutover.
- Overlap validation on `staff_schedules` is enforced **in the UI only** (client-side, before PUT). The database has no overlap constraint. This catches accidental overlaps during the drag/panel flow without requiring a server round-trip or complex constraint logic.
- No overlap validation on `staff_schedule_overrides`. Overlapping overrides are stored and rendered on the calendar; M6d defines precedence rules when computing availability.
- Deactivating a staff member with future bookings is allowed without warning in MVP.

## Out of scope

- Staff login / dashboard access.
- Staff photos or avatars.
- Calendar view filtered by staff member on the appointments page.
- Location assignment per staff member (M6c).
- Notification to staff when booked.
- `availability_rules` deprecation or removal (M6d).
- Drag-to-resize or drag-to-move existing override blocks on the calendar.

## Edge cases

| Scenario | Handling |
|----------|----------|
| PUT /schedules with empty windows array | Deletes all schedule rows — valid, no error. |
| PUT /services with empty serviceIds array | Removes all assignments — valid, no error. |
| Overlapping override date ranges | Stored without error; calendar renders both blocks. M6d defines precedence. |
| Override `endDate` < `startDate` | 422 at API validation layer before any DB write. |
| Override `endTime` <= `startTime` | 422 at API validation layer before any DB write. |
| Staff service is deleted | `ON DELETE CASCADE` on `staff_services(service_id)` removes the assignment; staff record unaffected. |
| Deactivating already-inactive staff | `PATCH { isActive: false }` is idempotent; returns 200 with current state. |
| Fetching a staff record from another tenant | RLS blocks the row; API returns 404. |
| Drag starts on an existing block | Block calls `stopPropagation` on `mousedown`; column never enters drag state. |
| Calendar navigates while override panel is open | Panel state is independent; navigation does not close the panel. |
