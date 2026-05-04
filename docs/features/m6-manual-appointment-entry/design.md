# Design: m6-manual-appointment-entry

## Problem

M5b delivered a read-only calendar. Business owners taking phone bookings have no way to add
appointments from the dashboard. This milestone adds manual appointment entry to the existing
`/appointments` page: a "New appointment" button and a click-drag gesture open a slide-over form
that posts to the existing bookings endpoint (M4b).

Constraints:
- No new route or page. The form overlays the existing appointments page.
- The existing `POST /tenants/:tenantId/bookings` endpoint is extended (phone, notes, override).
  Public endpoint `POST /public/:tenantSlug/bookings` is updated for schema compatibility but
  email stays required there (client-facing).
- `services` gains `duration_minutes` — required by the slot grid here and by the M7 booking
  widget. Better to add it now than create a gap mid-roadmap.
- No client table. Client identity is free-text (name + phone) stored per booking.
- Raw SQL, no ORM (ADR-004). Express Router (ADR-002). shadcn/ui (ADR-009).

## Components

### New files

| File | Responsibility |
|------|----------------|
| `apps/web/src/components/calendar/NewAppointmentPanel.tsx` | 480 px slide-over: client inputs, service chips/dropdown, date + slot grid, override checkbox, conflict warning, notes, footer summary, submit |
| `apps/web/src/hooks/useCreateBooking.ts` | Mutation: `POST /tenants/:tenantId/bookings` |
| `apps/web/src/hooks/useServiceSlots.ts` | Query: `GET /tenants/:tenantId/services/:serviceId/slots?date=YYYY-MM-DD` |

### Modified files

| File | Change |
|------|--------|
| `apps/web/src/components/calendar/DayColumn.tsx` | Add drag-selection gesture; ghost block during drag; `onTimeSelect` prop |
| `apps/web/src/components/calendar/CalendarToolbar.tsx` | Add "New appointment" Button |
| `apps/web/src/components/calendar/AppointmentDetailDialog.tsx` | Show `clientPhone`; show `clientEmail` only when non-null; show `notes` when non-null |
| `apps/web/src/pages/appointments/AppointmentsPage.tsx` | Panel open state; `onTimeSelect` handler; backdrop dismiss |
| `apps/web/src/hooks/useBookings.ts` | Extend `Booking` type: add `clientPhone`, `notes: string | null`; change `clientEmail` to `string | null` |
| `apps/api/src/routes/bookings.ts` | POST: add `clientPhone` (required), `clientEmail` (optional), `notes` (optional), `override` (optional bool); PATCH: add `notes`; extend `BookingRow`, `SELECT_COLS`, `format` |
| `apps/api/src/routes/services.ts` | Add `duration_minutes` to `ServiceRow`, `format`, SQL, `createSchema`, `patchSchema`; add `GET /:id/slots` handler |
| `apps/api/src/routes/public.ts` | Extend `BookingRow`, `SELECT_COLS`, `format` for `client_phone`, `notes`; `client_email` stays required in the public schema |
| `apps/api/src/lib/availability.ts` | Add `generateAllSlots` — same as `generateSlots` but includes taken slots with `available: false` |
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

### Updated services response shape

All service endpoints return `durationMinutes` in the response object. `POST` and `PATCH` accept
optional `durationMinutes: z.number().int().positive()`.

### Updated bookings POST

**Request (owner endpoint only)**
```json
{
  "serviceId": "uuid",
  "clientName": "string",
  "clientPhone": "string (min 7 chars, required)",
  "clientEmail": "string (email, optional)",
  "startAt": "iso8601",
  "endAt": "iso8601",
  "notes": "string (optional)",
  "override": false
}
```

When `override: true`: skip both `checkWithinAvailability` and `checkOverlap`. The public
`POST /public/:tenantSlug/bookings` does not accept `override`.

**Response 201** — booking object (same shape as before plus `clientPhone`, `notes`).

**Errors** — `403`, `404` service not found, `409` overlap or outside-availability (only when
`override` is absent or false), `422` validation.

### Updated bookings response shape

```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "serviceId": "uuid",
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

### New owner slots endpoint

```
GET /tenants/:tenantId/services/:serviceId/slots?date=YYYY-MM-DD
```

Requires `Authorization: Bearer <token>`. JWT `tenantId` must match `:tenantId`.

Returns all time slots in the service's availability window for the given date:

```json
[{ "startAt": "iso8601", "endAt": "iso8601", "available": boolean }]
```

- Slot increment = `service.duration_minutes`.
- `available: false` when any non-cancelled booking for this service overlaps the slot.
- Returns `[]` when no availability rules exist for that day of the week.
- `400` missing/invalid date, `403`, `404` service not found.

Implemented as `GET /:id/slots` in `apps/api/src/routes/services.ts`. Backed by the new
`generateAllSlots(client, serviceId, date, durationMinutes)` helper in `availability.ts`.

### Hook interfaces

```ts
// new
function useCreateBooking(): UseMutationResult<Booking, ApiError, CreateBookingInput>

interface CreateBookingInput {
  serviceId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  startAt: string;
  endAt: string;
  notes?: string;
  override?: boolean;
}

// new
function useServiceSlots(
  serviceId: string,
  date: string | null,   // YYYY-MM-DD; null disables the query
): UseQueryResult<Array<{ startAt: string; endAt: string; available: boolean }>>

// updated
interface Booking {
  id: string;
  tenantId: string;
  serviceId: string;
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

## Out of scope

- Client search / returning-client lookup (requires a client entity).
- SMS notification on booking creation (post-MVP per roadmap).
- Staff / provider selection (deferred to a later milestone).
- Service price (`price_cents`) on the services table (not needed by M6 or M7).
- Drag-and-drop rescheduling of existing appointments (post-MVP).

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
