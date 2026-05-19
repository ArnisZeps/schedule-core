# Design: Calendar Appointment Improvements

## Problem

Three gaps in the calendar view for business owners:

1. **No confirm action.** The API already stores `pending | confirmed | cancelled` status and `PATCH` already accepts `{ status: 'confirmed' }`, but the detail dialog only exposes cancel. Owners have no way to mark a booking as accepted.
2. **Past pending bookings are noisy.** An appointment that ended yesterday and was never acted on looks identical to one starting in an hour, making it hard to see what still needs attention.
3. **No staff isolation.** Multi-staff businesses can't view a single person's day. The service filter exists but staff does not.

All three are frontend-only changes — no API or schema modifications required.

## Components

| File | Change |
|------|--------|
| `apps/web/src/hooks/useBookings.ts` | Add `useConfirmBooking()` mutation |
| `apps/web/src/components/calendar/AppointmentDetailDialog.tsx` | Add Confirm button (pending only) |
| `apps/web/src/components/calendar/AppointmentBlock.tsx` | Apply "past" visual style when `endAt < now && status !== 'cancelled'` |
| `apps/web/src/components/calendar/CalendarToolbar.tsx` | Add staff filter dropdown |
| `apps/web/src/page-components/AppointmentsPage.tsx` | Read/write `staffId` URL param; apply client-side staff filter before passing bookings to views |

## Contracts

### `useConfirmBooking()`

```ts
function useConfirmBooking(): UseMutationResult<Booking, ApiError, string>
// argument: bookingId
// calls: PATCH /api/tenants/:tenantId/bookings/:id  { status: 'confirmed' }
// on success: invalidate ['bookings'] query
```

No API changes — `PATCH { status: 'confirmed' }` is already handled by `[bookingId]/route.ts`.

### Past visual state

Derived purely in `AppointmentBlock`:

```ts
const isPast = new Date(booking.endAt) < new Date() && booking.status !== 'cancelled'
```

When `isPast` is true: reduced opacity (`opacity-50`) and desaturated color variant. No new data needed.

### Staff filter URL param

`staffId` added alongside existing `serviceId` in URL search params. `AppointmentsPage` reads it and applies a client-side filter on the already-fetched bookings array before handing off to `WeekView`, `DayView`, and `ListView`.

Staff dropdown in `CalendarToolbar` receives `staffList` (from `useStaff()`) and `selectedStaffId` / `onStaffChange` as props — same pattern as the existing service filter.

## Rejected alternatives

- **Server-side `staffId` filter on `GET /bookings`**: unnecessary for calendar-scale data. The week/day fetch already returns a bounded set; filtering client-side avoids an API change and a round trip.
- **Auto-cancel past pending bookings**: requires a background job or business logic decision about what "past pending" means to the business. Out of scope here — visual distinction is sufficient.
- **New `expired` DB status**: over-engineered for a visual-only concern. Status reflects business intent; time elapsed is a display concern.

## Trade-offs accepted

- Past detection is a point-in-time client calculation. If the page sits open past midnight, a block won't turn "past" until next render cycle. Acceptable — the calendar refreshes on navigation.
- Confirming a past-pending appointment is allowed (button remains visible). Owners may want to retroactively record that an appointment did happen.

## Out of scope

- Bulk confirm / bulk cancel.
- Client-facing notification on confirmation (email/SMS — tracked separately).
- Auto-confirming bookings on creation.
- Filtering by multiple staff members simultaneously.
- Hiding cancelled or past appointments from the calendar entirely.

## Edge cases

- **Single-staff tenant**: staff dropdown shows one member + "All staff". Works correctly; low value but harmless.
- **Booking with `staffId: null`** (legacy, pre-M6d): not matched by any staff filter selection; shown only under "All staff". No special UI needed.
- **All staff deactivated**: `useStaff()` returns `[]`; dropdown shows "All staff" only.
- **Confirming an already-confirmed booking**: button is hidden; impossible through normal flow. API returns 200 (idempotent) as a safety net.
