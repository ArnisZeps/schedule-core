# Design: m6-manual-appointment-entry

## Problem

M5b delivered a read-only calendar. Business owners taking phone bookings have no way to add
appointments from the dashboard. This milestone adds manual appointment entry to the existing
`/appointments` page: a "New appointment" button and a click-drag gesture open a slide-over form
that posts to the existing bookings endpoint (M4b).

M6d (this update) completes the staff story: it adds staff selection to the slide-over and performs the availability cutover — replacing service-level `availability_rules` as the slot-generation source with per-staff `staff_schedules` and `staff_schedule_overrides` (deferred from M6b).

Constraints:
- No new route or page. The form overlays the existing appointments page.
- The existing `POST /tenants/:tenantId/bookings` endpoint is extended (phone, notes, override).
  Public endpoint `POST /public/:tenantSlug/bookings` is updated for schema compatibility but
  email stays required there (client-facing).
- `services` gains `duration_minutes` — required by the slot grid here and by the M7 booking
  widget. Better to add it now than create a gap mid-roadmap.
- No client table. Client identity is free-text (name + phone) stored per booking.
- Raw SQL, no ORM (ADR-004). shadcn/ui (ADR-009).

## Components

### New files

| File | Responsibility |
|------|----------------|
| `apps/web/src/components/calendar/NewAppointmentPanel.tsx` | 480 px slide-over: client inputs, service chips/dropdown, staff dropdown, date + slot grid, override checkbox, conflict warning, notes, footer summary, submit |
| `apps/web/src/hooks/useCreateBooking.ts` | Mutation: `POST /tenants/:tenantId/bookings` |
| `apps/web/src/hooks/useServiceSlots.ts` | Query: `GET /tenants/:tenantId/services/:serviceId/slots?date=YYYY-MM-DD[&staffId][&locationId]` |

### Modified files

| File | Change |
|------|--------|
| `apps/web/src/components/calendar/DayColumn.tsx` | Add drag-selection gesture; ghost block during drag; `onTimeSelect` prop |
| `apps/web/src/components/calendar/CalendarToolbar.tsx` | Add "New appointment" Button |
| `apps/web/src/components/calendar/AppointmentDetailDialog.tsx` | Show `clientPhone`; show `clientEmail` only when non-null; show `notes` when non-null |
| `apps/web/src/page-components/AppointmentsPage.tsx` | Panel open state; `onTimeSelect` handler; backdrop dismiss |
| `apps/web/src/hooks/useBookings.ts` | Extend `Booking` type: add `clientPhone`, `notes: string | null`; change `clientEmail` to `string | null` |
| `apps/web/app/api/tenants/[tenantId]/bookings/route.ts` | POST: add `clientPhone` (required), `clientEmail` (optional), `notes` (optional), `override` (optional bool); PATCH: add `notes`; extend `BookingRow`, `SELECT_COLS`, `format` |
| `apps/web/app/api/tenants/[tenantId]/services/[serviceId]/route.ts` | Add `duration_minutes` to `ServiceRow`, `format`, SQL, `createSchema`, `patchSchema` |
| `apps/web/app/api/tenants/[tenantId]/services/[serviceId]/slots/route.ts` | New: `GET` handler returning all slots with `available` flag |
| `apps/web/app/api/tenants/[tenantId]/services/[serviceId]/staff/route.ts` | **M6d:** `GET` handler returning active staff at a location assigned to this service |
| `apps/web/app/api/public/[tenantSlug]/bookings/route.ts` | Extend `BookingRow`, `SELECT_COLS`, `format` for `client_phone`, `notes`; `client_email` stays required in the public schema |
| `apps/web/src/lib/server/availability.ts` | Add `generateAllSlots` — same as `generateSlots` but includes taken slots with `available: false`. **M6d:** add `generateStaffSlots` and `generateAnyAvailableSlots`; remove `generateSlots` and `generateAllSlots` (superseded) |
| `apps/web/src/hooks/useStaff.ts` | **M6d:** add `useServiceStaff(serviceId, locationId)` query hook |
| `apps/web/src/hooks/useBookings.ts` | **M6d:** add `staffId: string \| null` and `staffName: string \| null` to `Booking` |
| `apps/web/src/hooks/useCreateBooking.ts` | **M6d:** add `staffId?: string \| null` to `CreateBookingInput` |
| `apps/web/src/components/calendar/AppointmentDetailDialog.tsx` | **M6d:** show staff name row when `staffName` is non-null |
| `packages/db/migrations/0004_m6_phone_notes_duration.sql` | Schema changes (see below) |
| `docs/db/data-model.md` | Document new columns |
| `docs/features/m4b-bookings-api/design.md` | Update POST contract and response shape |

## Contracts

### Migration — `0004_m6_phone_notes_duration.sql`

```sql
-- services: duration required for slot grid and M7 widget
ALTER TABLE services ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 30;

-- bookings: phone mandatory, notes internal, email now optional
ALTER TABLE bookings ADD COLUMN client_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN notes TEXT;
ALTER TABLE bookings ALTER COLUMN client_email DROP NOT NULL;
-- remove temporary default so new rows must supply a real value
ALTER TABLE bookings ALTER COLUMN client_phone DROP DEFAULT;
```

Rows created before this migration will have `client_phone = ''`. The detail dialog shows "—"
when the phone field is empty.

### Migration — `0007_m6d_booking_staff.sql`

```sql
-- 1. Add staff assignment to bookings
ALTER TABLE bookings ADD COLUMN staff_id UUID REFERENCES staff(id) ON DELETE RESTRICT;
CREATE INDEX ON bookings (staff_id);

-- 2. Drop availability_rules — slot generation now uses staff_schedules exclusively
DROP TABLE availability_rules;
```

No backfill for `staff_id`. Pre-M6d bookings retain `staff_id = NULL`. The API enforces non-null
for all owner-entry bookings created post-M6d. The detail dialog renders "—" when `staffId` is
null.

`availability_rules` is dropped in the same migration to keep the cutover atomic. All API
endpoints and UI referencing this table must be removed before the migration runs.

### Updated services response shape

All service endpoints return `durationMinutes` in the response object. `POST` and `PATCH` accept
optional `durationMinutes: z.number().int().positive()`.

### Updated bookings POST

**Request (owner endpoint only)**
```json
{
  "serviceId": "uuid",
  "locationId": "uuid",
  "staffId": "uuid | null",
  "clientName": "string",
  "clientPhone": "string (min 7 chars, required)",
  "clientEmail": "string (email, optional)",
  "startAt": "iso8601",
  "endAt": "iso8601",
  "notes": "string (optional)",
  "override": false
}
```

`staffId` rules:
- UUID provided: staff must be active and assigned to the service via `staff_services`. Validates
  no non-cancelled booking for that staff overlaps `[startAt, endAt)`. `409` on conflict unless
  `override: true`.
- `null` / absent (any available): server queries active staff at `locationId` assigned to this
  service, ordered by `created_at`. Assigns the first with no conflicting booking. `409` if all
  are conflicted unless `override: true`, in which case assigns the first qualified staff
  regardless of conflicts.

When `override: true`: skip `checkWithinAvailability`, `checkOverlap`, and staff conflict check.
The public `POST /public/:tenantSlug/bookings` does not accept `override`.

**Response 201** — booking object (same shape as before plus `clientPhone`, `notes`, `staffId`, `staffName`).

**Errors** — `403`, `404` service not found, `409` overlap, outside-availability, or no staff
available for the slot (only when `override` is absent or false), `422` validation.

### Updated bookings response shape

```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "serviceId": "uuid",
  "locationId": "uuid",
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
}
```

`staffName` is joined from `staff.name` at query time. Pre-M6d bookings return `null` for both
`staffId` and `staffName`.

### Staff-for-service endpoint

```
GET /tenants/:tenantId/services/:serviceId/staff?locationId=UUID
```

Requires `Authorization: Bearer <token>`. `locationId` is required (`400` if absent).

Returns active staff members (`is_active = true`) at the given location who are assigned to this
service via `staff_services`. Response: array of staff objects (same shape as
`GET /tenants/:tenantId/staff`). Returns `[]` when no active qualified staff exist at the location.

### Owner slots endpoint

```
GET /tenants/:tenantId/services/:serviceId/slots?date=YYYY-MM-DD[&staffId=UUID][&locationId=UUID]
```

Requires `Authorization: Bearer <token>`. JWT `tenantId` must match `:tenantId`.

Returns all time slots with `available` flag:

```json
[{ "startAt": "iso8601", "endAt": "iso8601", "available": boolean }]
```

- When `staffId` is provided: slots are generated from that staff member's `staff_schedules` and
  `staff_schedule_overrides`. `available: false` when the staff member has any non-cancelled
  booking overlapping the slot. `locationId` is ignored.
- When `staffId` is absent ("any available"): `locationId` is required (`400` if absent). A slot
  is included when at least one active qualified staff member at the location has schedule
  availability and no conflicting booking. `available: false` when every qualified staff member
  has a conflict.
- Slot increment = `service.duration_minutes`.
- Returns `[]` when no relevant staff member has `staff_schedules` windows for the given day of
  the week.
- `400` missing/invalid date or missing `locationId` when `staffId` absent, `403`, `404` service
  not found.

`availability_rules` are **no longer consulted** as of M6d. Backed by
`generateStaffSlots(client, staffId, date, durationMinutes)` and
`generateAnyAvailableSlots(client, tenantId, serviceId, locationId, date, durationMinutes)` in
`apps/web/src/lib/server/availability.ts`.

### Hook interfaces

```ts
// new
function useCreateBooking(): UseMutationResult<Booking, ApiError, CreateBookingInput>

interface CreateBookingInput {
  serviceId: string;
  locationId: string;
  staffId?: string | null;  // null = auto-assign
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  startAt: string;
  endAt: string;
  notes?: string;
  override?: boolean;
}

// new / M6d: updated signature
function useServiceSlots(
  serviceId: string,
  date: string | null,       // YYYY-MM-DD; null disables the query
  staffId: string | null,    // UUID for specific staff; null = "any available"
  locationId: string | null, // required when staffId is null
): UseQueryResult<Array<{ startAt: string; endAt: string; available: boolean }>>

// M6d: add useServiceStaff
function useServiceStaff(
  serviceId: string | null,
  locationId: string | null,
): UseQueryResult<Staff[]>

// updated
interface Booking {
  id: string;
  tenantId: string;
  serviceId: string;
  locationId: string;
  staffId: string | null;
  staffName: string | null;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  startAt: string;
  endAt: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes: string | null;
  createdAt: string;
}
```

`useCreateBooking` on success calls `queryClient.invalidateQueries({ queryKey: ['bookings'] })`.

### Drag-selection protocol

`DayColumn` receives:

```ts
onTimeSelect: (startAt: Date, endAt: Date) => void
```

- `mousedown` on the column container (not on an AppointmentBlock): start drag.
- `mousemove`: while dragging, render a ghost `div` spanning dragStart to current position.
- `mouseup`: compute snapped start/end (15-min grid), call `onTimeSelect(startAt, endAt)` and clear drag state.
- Times are snapped to 15-minute boundaries. `endAt = snap(mouseup) + 15 min`.

`AppointmentsPage` receives full `Date` objects and passes them directly to `NewAppointmentPanel`
as `prefillStart` / `prefillEnd` props.

### Panel state (AppointmentsPage)

Three separate `useState` values manage panel visibility and prefill:

```ts
const [panelOpen, setPanelOpen] = useState(false)
const [prefillStart, setPrefillStart] = useState<Date | undefined>()
const [prefillEnd, setPrefillEnd] = useState<Date | undefined>()
```

`NewAppointmentPanel` receives `prefillStart` and `prefillEnd` as optional props; when present,
`selectedSlot` is initialised from them via the `useState` lazy initialiser.

## Availability Cutover

M6d performs the cutover deferred from M6b. After this milestone:

- Slot generation (`GET .../slots`) uses `staff_schedules` and `staff_schedule_overrides` as
  the source of truth for the owner slots endpoint.
- `availability_rules` and their API endpoints remain in the database and API but are no longer
  consulted by slot generation.
- `generateSlots` and `generateAllSlots` in `availability.ts` are removed and replaced by
  `generateStaffSlots` and `generateAnyAvailableSlots`.
- The public slots endpoint (`GET /public/:tenantSlug/services/:serviceId/slots`) is also updated
  to use `generateAnyAvailableSlots`. It resolves location as the tenant's single active location
  (same logic as M6c public bookings); returns `422` for multi-location tenants until M7 adds
  location and staff selection to the public widget.
- The `availability_rules` CRUD API endpoints and their corresponding dashboard UI (introduced in
  M5a) are removed. Owners configure availability via staff schedules on the staff detail page.
- `availability_rules` is dropped from the database in migration `0007`.

## Rejected alternatives

**Modal/Dialog instead of slide-over** — a dialog obscures the calendar context. The slide-over
keeps the schedule visible so the owner can visually confirm the slot while filling in client
details.

**Client typeahead against existing bookings** — searching bookings by name or phone to pre-fill
returning-client data requires a sequential scan (no client table, no FTS index). Deferred
post-MVP when a client entity is introduced.

**Reuse public slots endpoint** — `GET /public/:tenantSlug/services/:serviceId/slots` returns
only available slots and requires a slug. The owner form needs all slots (with taken state) and
resolves service ownership via the JWT. A separate owner endpoint is cleaner.

**Duration as a query param on the owner slots endpoint** — the service has `duration_minutes`
now. Passing duration as a param duplicates information and allows the UI to request
inconsistent slot sizes. The endpoint derives duration from the service row.

**`datetime-local` inputs instead of slot grid** — free-form time entry is error-prone for busy
owners. The slot grid reduces input to one click; conflict state is immediately visible.

**Ghost block in a separate overlay layer** — a separate absolutely-positioned overlay for the
ghost block requires z-index coordination across all DayColumns. Rendering the ghost inside the
DayColumn's own relative container (same as AppointmentBlocks) is simpler.

**M6d — Making `staff_id` NOT NULL immediately** — pre-M6d bookings have no staff assignment;
backfilling would require inserting a dummy staff record, corrupting the audit trail. Nullable in
the DB, enforced non-null at the API layer for new bookings, is the same pattern used for
`location_id` in M6c.

**M6d — Keeping `availability_rules` as a fallback alongside staff schedules** — two availability
systems require the owner to keep them in sync. The staff-schedule system is strictly more
granular. A fallback would silently serve stale data for tenants who configure staff schedules
but do not update service rules. The cutover is intentional.

**M6d — Staff picker before service picker** — service constrains staff choice (staff must be
assigned to the service via `staff_services`). Picking service first yields a correctly filtered
list. Picking staff first would either show all staff or require re-filtering after staff
selection.

**M6d — Embedding staff name via a separate lookup in AppointmentDetailDialog** — joining
`staff.name` in the bookings SQL and returning `staffName` avoids a second network call in the
dialog. The trade-off (name denormalization) is acceptable: if a staff member is renamed,
historical bookings reflect the current name, which is fine for MVP.

## Trade-offs accepted

- Services created before M6 get `duration_minutes = 30` (migration default). Owners must update
  services whose actual duration differs. No automated correction.
- `client_phone` is free text. No E.164 normalization or format enforcement beyond minimum
  length (7 chars).
- `override: true` bypasses both the availability check and the overlap check entirely. A more
  granular "override only overlap" or "override only availability" is post-MVP.
- Conflict warning is computed client-side by comparing the selected slot against the bookings
  returned by `useBookings` for the panel's selected date. A separate `useBookings` call is made
  scoped to that date when the user changes the panel's date away from the calendar's current range.
  Staff-level conflict detection is handled server-side via the slots endpoint (`available: false`)
  and the POST endpoint (409).
- `staff_id` is nullable in the database. Pre-M6d bookings retain `NULL`; the API enforces
  non-null for new bookings. Historical detail views show "—" for staff.
- `staffName` is denormalized from `staff.name` at query time. Renaming a staff member updates
  the name returned for all bookings, including historical ones. Snapshotting the name at booking
  time is post-MVP.

## Out of scope

- Client search / returning-client lookup (requires a client entity).
- SMS notification on booking creation (post-MVP per roadmap).
- Public booking staff selection (M7).
- Service price (`price_cents`) on the services table (not needed by M6 or M7).
- Drag-and-drop rescheduling of existing appointments (post-MVP).
- Per-location services (services remain tenant-wide).
- Per-slot "which staff are available" breakdown beyond the binary available/unavailable state.

## Edge cases

| Scenario | Handling |
|----------|----------|
| Service has no availability rules on the selected date | Slot grid shows "No availability on this date." Override checkbox still visible (allows booking via drag-prefill). |
| User changes date in the panel | `useServiceSlots` refetches for the new date; selected slot resets. |
| User changes service in the panel | `useServiceSlots` refetches for the selected date with the new service; selected slot resets. |
| Drag starts on an existing AppointmentBlock | Block calls `stopPropagation` on `mousedown`; DayColumn never enters drag state. |
| Panel open while user navigates calendar weeks | Calendar navigation does not close the panel; the panel's internal date is independent. |
| `clientPhone = ''` on pre-migration bookings | Detail dialog renders empty string (no "—" substitution). |
| Override=true but API still returns 409 | Should not occur; log a warning and show a generic error in the panel. |
| Booking created while calendar query is in-flight | `invalidateQueries` on success cancels in-flight and triggers a fresh fetch. |
| Service has no active staff at the selected location | Slot grid shows "No qualified staff at this location." Staff dropdown shows only "Any available" with inline note. |
| "Any available" selected; all qualified staff booked for the chosen slot | 409: `{ error: "No staff available for this slot." }` Panel stays open. |
| Specific staff selected; staff has no schedule windows for chosen day | Slot grid shows "No availability for [name] on this date." Override checkbox still visible. |
| `staffId` provided but not assigned to the selected service | 422 validation error before any DB write. |
| `staffId` provided but staff is inactive | 422 validation error before any DB write. |
| Staff deactivated between panel open and form submit | 422 from API; inline error shown; panel stays open. |
| `override: true` + null `staffId`; all qualified staff have conflicts | Server assigns first qualified active staff regardless of conflicts. 409 only if no active qualified staff exists at all. |
| Owner changes location after selecting a staff member | Staff selection resets; slot grid refetches for the new location's staff. |
