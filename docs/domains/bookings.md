# Domain: Bookings

Owner-side appointment management — calendar view, manual entry, reschedule, cancel, and slot queries. For the public client-facing booking flow see [booking-widget.md](booking-widget.md).

## Schema

Table: `bookings` — see [data-model.md](../db/data-model.md).

## API — Owner routes

All owner routes require the `sc_token` HttpOnly cookie (read by `withAuth.ts`). `req.auth.tenantId` must match `:tenantId` → 403. Queries run inside `withTenantContext`.

| File | Responsibility |
|------|----------------|
| `apps/web/app/api/tenants/[tenantId]/bookings/route.ts` | Booking list + create |
| `apps/web/app/api/tenants/[tenantId]/bookings/[bookingId]/route.ts` | Booking update |
| `apps/web/app/api/tenants/[tenantId]/services/[serviceId]/slots/route.ts` | Slot generation for manual entry panel |
| `apps/web/app/api/tenants/[tenantId]/services/[serviceId]/staff/route.ts` | Active qualified staff for a service at a location |

---

### `GET /api/tenants/:tenantId/bookings`

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
}]
```

`staffName` is joined from `staff.name` at query time. Bookings with no staff assignment return `null` for both `staffId` and `staffName`.

**Errors:** `400` invalid date param, `403`

---

### `POST /api/tenants/:tenantId/bookings`

**Request**
```json
{
  "serviceId": "uuid",
  "locationId": "uuid",
  "staffId": "uuid | null",
  "clientName": "string",
  "clientPhone": "string (min 7 chars)",
  "clientEmail": "string (email, optional)",
  "startAt": "iso8601",
  "endAt": "iso8601",
  "notes": "string (optional)",
  "override": "boolean (optional, default false)"
}
```

**Staff assignment rules**
- `staffId` provided, `override: false`: validates staff is active, assigned to service at `locationId`, no overlapping non-cancelled booking → 422 or 409 if not
- `staffId` null, `override: false`: auto-assigns first free active+qualified staff at `locationId` (ordered by `created_at`) → 409 if all are booked
- `staffId` provided, `override: true`: skips all checks, assigns directly
- `staffId` null, `override: true`: assigns first qualified staff regardless of conflicts

**Response 201** — booking object (same shape as GET list item).

**Errors:** `403`, `404` service not found, `409` overlap (only when `override` false/absent), `422` validation or staff not eligible

---

### `PATCH /api/tenants/:tenantId/bookings/:id`

All fields optional; at least one must be present.

**Request**
```json
{
  "status": "confirmed | cancelled",
  "startAt": "iso8601",
  "endAt": "iso8601",
  "notes": "string",
  "override": "boolean (optional, default false)"
}
```

When `override: true` and times are being updated: skips overlap check. Consistent with `POST` override semantics.

**Response 200** — updated booking object.

**Errors:** `403`, `404`, `409` overlap (only when `override` false/absent) or `already_cancelled`, `422`

---

### `GET /api/tenants/:tenantId/services/:serviceId/slots`

Returns all time slots (available and unavailable) for a service on a date. Used exclusively by the manual entry panel.

**Query params**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| date | YYYY-MM-DD | yes | Date to generate slots for |
| staffId | UUID | no | Slots for that staff member only; absent = "any available" |
| locationId | UUID | conditional | Required when `staffId` absent |

**Response 200**
```json
[{ "startAt": "iso8601", "endAt": "iso8601", "available": "boolean" }]
```

Slot increment = `service.duration_minutes`.

- `staffId` provided: slots from that staff member's `staff_schedules` + `staff_schedule_overrides`. `available: false` when that staff member has a conflicting non-cancelled booking.
- `staffId` absent: slot available when at least one active qualified staff member at `locationId` has schedule availability. `available: false` when all qualified staff have a conflict.

**Errors:** `400` missing/invalid params, `403`, `404` service not found

---

### `GET /api/tenants/:tenantId/services/:serviceId/staff?locationId=UUID`

Active staff assigned to a service at a given location (via `staff_services`). `locationId` required — 400 if absent.

**Response 200** — array of staff objects (same shape as `GET /api/tenants/:tenantId/staff`). Returns `[]` when no active qualified staff exist.

**Errors:** `400`, `403`, `404`

---

## Slot generation — `apps/web/src/lib/server/availability.ts`

### `checkOverlap(client, serviceId, start, end, excludeId?)`

```sql
SELECT 1 FROM bookings
WHERE service_id = $1 AND status != 'cancelled'
  AND start_at < $3 AND end_at > $2 [AND id != $4]
```

Returns 409 `{ "error": "overlap" }` if any row found.

### `checkStaffOverlap(client, staffId, start, end, excludeId?)`

Same overlap logic scoped to a specific staff member instead of a service.

### `generateStaffSlots(client, staffId, date, durationMinutes)`

1. Fetches `staff_schedules` windows for the matching `day_of_week`
2. Applies `staff_schedule_overrides`: `available` type adds windows, `not_available` type removes blocks
3. Marks each slot `available: false` if a non-cancelled booking overlaps

### `generateAnyAvailableSlots(client, tenantId, serviceId, locationId, date, durationMinutes)`

Union of slots across all active staff assigned to `serviceId` at `locationId`. A slot is `available: true` if at least one staff member is free at that time.

---

## Frontend

### Routes

| Route | File |
|-------|------|
| `/appointments` | `apps/web/app/(dashboard)/appointments/page.tsx` — async Server Component; pre-fetches bookings, services, staff, locations, and service-staff mapping for the initial view |

`appointments/page.tsx` reads `x-tenant-id` from headers and `searchParams.from`/`to` (YYYY-MM-DD). When absent it defaults to the UTC Monday of the current week. It runs five parallel queries inside a single `withTenantContext` transaction:

1. Active services
2. All locations (including inactive)
3. Active staff
4. Bookings for the requested week/day range
5. `SELECT ss.service_id, s.* FROM staff_services ss JOIN staff s ON s.id = ss.staff_id WHERE s.is_active = true` — all active service-staff assignments

Results are serialised into a React Query dehydrated state via `makeQueryClient()` + `setQueryData` + `dehydrate`, then passed as `dehydratedState` to `AppointmentsPage`. `HydrationBoundary` inside `AppointmentsPage` deserialises the state before children mount — no loading skeleton on first render.

React Query keys pre-populated on the server:
- `['bookings', tenantId, { from: fromISO, to: toISO, serviceId: undefined }]`
- `['services', tenantId]`
- `['locations', tenantId, { includeInactive: true }]`
- `['staff', tenantId, { includeInactive: false, locationId: undefined }]`
- `['service-staff', tenantId, serviceId, locationId]` — one entry per `(serviceId, locationId)` pair

ISO keys use UTC midnight: `dateStr + 'T00:00:00.000Z'`. This is timezone-safe — the same construction on server and client guarantees cache hits.

### Hooks

```ts
// apps/web/src/hooks/useBookings.ts
interface Booking {
  id: string; tenantId: string; serviceId: string; locationId: string
  staffId: string | null; staffName: string | null
  clientName: string; clientPhone: string; clientEmail: string | null
  startAt: string; endAt: string
  status: 'pending' | 'confirmed' | 'cancelled'
  notes: string | null; createdAt: string
}

function useBookings(params: { from: string; to: string; serviceId?: string }): UseQueryResult<Booking[]>
function useBookingsPrefetch(params: { view: 'week' | 'day' | 'list'; from: string; to: string; serviceId?: string }): void
function useUpcomingBookings(params: { serviceId?: string }): UseQueryResult<Booking[]>
function useCancelBooking(): UseMutationResult<Booking, ApiError, string>
function useRescheduleBooking(): UseMutationResult<Booking, ApiError, { id: string; startAt: string; endAt: string; override?: boolean }>

// apps/web/src/hooks/useCreateBooking.ts
function useCreateBooking(): UseMutationResult<Booking, ApiError, CreateBookingInput>

interface CreateBookingInput {
  serviceId: string; locationId: string; staffId?: string | null
  clientName: string; clientPhone: string; clientEmail?: string
  startAt: string; endAt: string; notes?: string; override?: boolean
}

// apps/web/src/hooks/useServiceSlots.ts
function useServiceSlots(
  serviceId: string,
  date: string | null,
  staffId: string | null,
  locationId: string | null
): UseQueryResult<Array<{ startAt: string; endAt: string; available: boolean }>>
```

All mutations call `queryClient.invalidateQueries({ queryKey: ['bookings'] })` on success.

### Calendar components

| File | Responsibility |
|------|----------------|
| `apps/web/src/page-components/appointments/AppointmentsPage.tsx` | Client Component. Accepts `dehydratedState?: DehydratedState`; wraps children in `HydrationBoundary`. Owns `view`, `dateStr`, `serviceId`, `staffId` as `useState` (initialised from URL params on mount). Week view reads/writes `?from=YYYY-MM-DD&to=YYYY-MM-DD`; day view uses `?view=day&date=YYYY-MM-DD`. Builds ISO keys as `dateStr + 'T00:00:00.000Z'`. Syncs URL via `router.replace` as a side effect. |
| `apps/web/src/components/calendar/CalendarToolbar.tsx` | Pure controlled component. Prev/next/today; week/day/list toggle; service and staff filters; "New appointment" button. All state and nav callbacks passed as props — no internal routing. |
| `apps/web/src/components/calendar/WeekView.tsx` | 7-column CSS Grid; renders TimeGutter + DayColumns |
| `apps/web/src/components/calendar/DayView.tsx` | Single-column; renders TimeGutter + one DayColumn |
| `apps/web/src/components/calendar/TimeGutter.tsx` | Left column: 24 hour labels at 64 px each |
| `apps/web/src/components/calendar/DayColumn.tsx` | 1536 px tall relative container; appointment blocks with overlap layout; drag-selection gesture (15-min snap) that opens the manual entry panel |
| `apps/web/src/components/calendar/AppointmentBlock.tsx` | Absolutely positioned block; coloured by status; click opens detail dialog |
| `apps/web/src/components/calendar/ListView.tsx` | shadcn Table of upcoming bookings |
| `apps/web/src/components/calendar/AppointmentDetailDialog.tsx` | Full booking details; confirm/cancel via AlertDialog; "Reschedule appointment" button triggers `onReschedule(booking)` callback — opens `NewAppointmentPanel` in reschedule mode |

### Calendar layout

- Each hour row: 64 px. Block `top = (startMinutes / 60) × 64 px`, `height = (durationMinutes / 60) × 64 px`, `min-height: 24 px`.
- Overlap layout: `computeColumnLayout(appointments)` — greedy column assignment, `left = (colIndex / colCount) × 100%`, `width = (1 / colCount × 100%) − 2 px`.
- Navigation state (`view`, `dateStr`, `serviceId`, `staffId`) lives in `useState` in `AppointmentsPage` for synchronous React renders. The URL is kept in sync via `router.replace` as a side effect. Week view URL: `?from=YYYY-MM-DD&to=YYYY-MM-DD`; day view: `?view=day&date=YYYY-MM-DD`. URL does not drive rendering — it is only a permalink/back-button aid.
- Week view scrolls horizontally on narrow viewports (`min-w-[640px]`, outer `overflow-x: auto`).
- Current-time indicator: `position: absolute; height: 2px; background: red-500` at `(hour × 60 + minutes) / 60 × 64 px`. Updated every minute via `setInterval`.

### Manual entry panel

| File | Responsibility |
|------|----------------|
| `apps/web/src/components/calendar/NewAppointmentPanel.tsx` | 480 px slide-over. Accepts `mode?: 'new' \| 'reschedule'` and `rescheduleBooking?: Booking`. In `'new'` mode: service chips, staff dropdown, location selector, date + slot grid, override checkbox, conflict warning, notes, client fields. In `'reschedule'` mode: client/service/location/staff fields pre-filled and locked; submits via `useRescheduleBooking`. Both modes: "Custom time" collapsible section (`type="text"` input with `placeholder="HH:MM"`, computed end time, sends `override: true`). The input is `type="text"` (not `type="time"`) to avoid Safari iOS native picker overflow on narrow viewports. |

**Drag-to-open:** `mousedown` on `DayColumn` (not on an existing block) → `mousemove` ghost block → `mouseup` snap to 15-min grid → `onTimeSelect(startAt, endAt)` → `AppointmentsPage` opens panel with `prefillStart` / `prefillEnd`.

**Panel state** (in `AppointmentsPage`):
```ts
const [panelOpen, setPanelOpen] = useState(false)
const [prefillStart, setPrefillStart] = useState<Date | undefined>()
const [prefillEnd, setPrefillEnd] = useState<Date | undefined>()
const [rescheduleBooking, setRescheduleBooking] = useState<Booking | undefined>()
```

When `rescheduleBooking` is set, the panel receives `mode='reschedule'` and `rescheduleBooking`. Clicking "Reschedule appointment" in `AppointmentDetailDialog` closes the dialog, sets `rescheduleBooking`, and opens the panel.

**Location data:** `NewAppointmentPanel` receives `locations: Location[]` as a prop from `AppointmentsPage`. It does not call `useLocations()` internally. `AppointmentsPage` calls `useLocations(true)` — the HydrationBoundary pre-populates the `['locations', tenantId, { includeInactive: true }]` key from SSR, so locations are present on first render with no network round-trip. The panel derives `activeLocations = locations.filter(l => l.isActive)` and shows the picker only when `activeLocations.length > 1`.

**Service → Staff dependency:** after service and location are selected, `useServiceStaff(serviceId, locationId)` (from [staff.md](staff.md)) fetches eligible staff. Staff selection resets when service or location changes.

## Constraints

- All times stored and returned as UTC ISO 8601. Display formatting is a UI concern — `new Date(isoString)` converts to browser local timezone automatically.
- `staffId` is nullable in DB. Bookings from before staff selection was introduced have `null`. API enforces non-null for new owner bookings.
- `override: true` bypasses availability check, overlap check, and staff conflict check entirely.
- Cancel is `PATCH { status: 'cancelled' }` — no hard delete. Cancelled bookings are preserved in history.
- `clientPhone` required (min 7 chars, free text). `clientEmail` optional for owner entry.
- Reschedule excludes self from overlap check (`excludeId`) so a booking can be moved to the same slot.
