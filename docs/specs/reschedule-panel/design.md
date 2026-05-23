# Design: Reschedule Panel

## Problem

The current reschedule form in `AppointmentDetailDialog` uses raw `datetime-local` inputs for "New start" and "New end". Owners must manually type a datetime rather than see available slots — the very UX improvement that the manual entry panel already provides for new bookings.

Fix: reuse `NewAppointmentPanel` for reschedule. The owner sees the same calendar + slot grid, prefilled with the booking's existing data, and only needs to pick a new time.

Additionally, there is no ergonomic way to book outside working hours. The existing "override" checkbox is buried and provides no time-entry UX. A dedicated "Custom time" collapsible section addresses this for both new bookings and reschedules.

## Components

| File | Change |
|------|--------|
| `apps/web/src/components/calendar/AppointmentDetailDialog.tsx` | Remove datetime reschedule form. Add `onReschedule: (booking: Booking) => void` prop. Replace the reschedule section with a single "Reschedule appointment" button. |
| `apps/web/src/components/calendar/NewAppointmentPanel.tsx` | Add `mode?: 'new' \| 'reschedule'` (default `'new'`) and `rescheduleBooking?: Booking` props. In reschedule mode: lock service/location/staff/client fields; prefill date + slot; change title and submit label; call `useRescheduleBooking` on submit. Add "Custom time" collapsible section (both modes). |
| `apps/web/src/page-components/appointments/AppointmentsPage.tsx` | Add `rescheduleBooking: Booking \| undefined` state. Wire `AppointmentDetailDialog.onReschedule` → close dialog, set `rescheduleBooking`, open panel. Clear `rescheduleBooking` when panel closes. |
| `apps/web/src/hooks/useBookings.ts` | Extend `useRescheduleBooking` mutation input with `override?: boolean`. |
| `apps/web/app/api/tenants/[tenantId]/bookings/[bookingId]/route.ts` | Accept `override?: boolean` in PATCH body. When `override: true`: skip `checkOverlap` and `checkStaffOverlap`. |

## Contracts

### AppointmentDetailDialog — updated props

```ts
interface AppointmentDetailDialogProps {
  booking: Booking | null
  open: boolean
  onClose: () => void
  onReschedule: (booking: Booking) => void  // replaces inline form
}
```

The reschedule section inside the dialog becomes a single "Reschedule appointment" button. No datetime inputs remain in the dialog.

### NewAppointmentPanel — updated props

```ts
interface NewAppointmentPanelProps {
  // existing
  open: boolean
  onClose: () => void
  prefillStart?: Date
  prefillEnd?: Date
  services: Service[]
  staff: Staff[]
  locations: Location[]
  serviceStaff: ServiceStaffEntry[]
  // new
  mode?: 'new' | 'reschedule'     // default 'new'
  rescheduleBooking?: Booking      // required when mode === 'reschedule'
}
```

Behaviour when `mode === 'reschedule'`:

| Field | Behaviour |
|-------|-----------|
| Panel title | "Reschedule appointment" |
| Service chip selector | Pre-selected from `rescheduleBooking.serviceId`; non-interactive (pointer-events-none, muted) |
| Location selector | Pre-selected from `rescheduleBooking.locationId`; non-interactive |
| Staff selector | Pre-selected from `rescheduleBooking.staffId`; non-interactive |
| Client name / phone / email | Pre-filled; `readOnly` attribute set |
| Date | Initialized to the date portion of `rescheduleBooking.startAt` |
| Selected slot | Initialized to the slot matching `rescheduleBooking.startAt`; if no slot matches (slot shows unavailable because the booking occupies it), no slot is pre-selected |
| Submit button label | "Reschedule appointment" |
| Submit action | Calls `useRescheduleBooking({ id: rescheduleBooking.id, startAt, endAt, override? })` |

### useRescheduleBooking — updated interface

```ts
function useRescheduleBooking(): UseMutationResult<
  Booking,
  ApiError,
  { id: string; startAt: string; endAt: string; override?: boolean }
>
// calls: PATCH /api/tenants/:tenantId/bookings/:id  { startAt, endAt, override? }
// on success: invalidate ['bookings'] query
```

### PATCH /api/tenants/:tenantId/bookings/:id — updated body

```json
{
  "status": "confirmed | cancelled",
  "startAt": "iso8601",
  "endAt": "iso8601",
  "notes": "string",
  "override": "boolean (optional, default false)"
}
```

When `override: true`: skip `checkOverlap` and `checkStaffOverlap`. Write the new times directly. Consistent with how `POST` handles the flag.

### Custom time section (NewAppointmentPanel)

Collapsible section rendered below the slot grid in both modes.

**Collapsed (default):** "Use custom time" toggle/link.

**Expanded:**
- `<input type="time">` for `customStartTime`
- Read-only "Ends at HH:MM" computed from `customStartTime + service.durationMinutes`
- Slot grid and its loading/empty states are hidden

**Toggling off:** clears `customStartTime`, restores slot grid, no slot pre-selected.

**Submit behaviour when custom time is active:**
- Derives `startAt` from the selected date + `customStartTime`
- Derives `endAt = startAt + durationMinutes`
- Sends `override: true` in POST (new mode) or PATCH (reschedule mode)
- The override checkbox is not shown separately when custom time is active (override is implicit)

### AppointmentsPage — updated state

```ts
const [rescheduleBooking, setRescheduleBooking] = useState<Booking | undefined>()
```

`onReschedule` handler:
1. `setDetailBooking(null)` — closes `AppointmentDetailDialog`
2. `setRescheduleBooking(booking)`
3. `setPanelOpen(true)`

On panel close (submit or dismiss):
1. `setPanelOpen(false)`
2. `setRescheduleBooking(undefined)`

## Rejected alternatives

**New `ReschedulePanel` component** — duplicates the full panel UI. Sharing `NewAppointmentPanel` via a `mode` prop is less code and guarantees the two flows stay visually consistent.

**`excludeBookingId` on the slots endpoint** — the booking's own slot shows as `available: false` in the slot grid (the booking occupies it). An `excludeBookingId` param would fix this display detail but is not critical to the UX goal. Deferred; the owner is picking a new time anyway.

**Allow service/location/staff changes during reschedule** — `PATCH` does not accept `serviceId`, `locationId`, or `staffId`. Supporting those changes would require cancel + create. Out of scope; owners who need this can cancel and re-book.

**Merge custom time into the slot grid** — an "other time" tile inside the grid is less discoverable and harder to implement cleanly. A separate collapsible section is explicit and self-contained.

**Keep override checkbox visible alongside custom time** — the override checkbox currently exists on the panel for the slot grid path. When custom time is active, override is implicit; showing both would be confusing.

## Trade-offs accepted

- The booking's own time slot shows as `available: false` in reschedule mode slot grid. Accepted for MVP; `excludeBookingId` is a follow-up.
- Client and service fields are locked in reschedule mode. If the owner needs to change those, they cancel and create a new booking.
- Custom time trusts the owner to pick a sensible time. No client-side schedule validation is performed when custom time is active — server-side `override: true` bypasses checks entirely.

## Out of scope

- `excludeBookingId` param on the slots endpoint.
- Changing service/location/staff/client details during reschedule.
- Notes update from the reschedule panel (PATCH already supports notes independently via the detail dialog).
- Drag-and-drop rescheduling on the calendar (noted as post-MVP in m6-manual-appointment-entry design).
