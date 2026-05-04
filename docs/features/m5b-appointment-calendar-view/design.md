# Design: m5b-appointment-calendar-view

## Problem

M4b delivered a complete bookings API. Business owners have no UI to see or act on those bookings.
They need a calendar to understand their schedule, navigate time, and manage individual appointments
(cancel, reschedule). This milestone delivers that view, building on the M5a shell and M5c
component system.

## New dependencies

| Package | Kind | Purpose |
|---------|------|---------|
| `date-fns` | runtime | Week boundaries, day iteration, formatting, minute-diff — calendar math that is error-prone with native Date |

No third-party calendar library. A custom CSS Grid calendar keeps the bundle small, avoids style
conflicts with shadcn/Tailwind, and gives full control over layout. `date-fns` is the only
addition; it is tree-shakeable and already the ecosystem standard for this use case.

## Components

### Page

| File | Responsibility |
|------|----------------|
| `src/pages/appointments/AppointmentsPage.tsx` | Reads URL search params (`view`, `date`, `serviceId`); fetches bookings + services; composes toolbar and active view |

### Calendar components

| File | Responsibility |
|------|----------------|
| `src/components/calendar/CalendarToolbar.tsx` | Prev/next/today navigation; week/day/list toggle; service Select |
| `src/components/calendar/WeekView.tsx` | 7-column grid; renders TimeGutter + seven DayColumns |
| `src/components/calendar/DayView.tsx` | Single-column grid; renders TimeGutter + one DayColumn |
| `src/components/calendar/TimeGutter.tsx` | Left column: 24 hour labels, each 64 px tall |
| `src/components/calendar/DayColumn.tsx` | Relative container 1536 px tall; renders 24 hour-line divs + AppointmentBlocks with computed layout |
| `src/components/calendar/AppointmentBlock.tsx` | Absolutely positioned block; colored by status; click handler |
| `src/components/calendar/ListView.tsx` | shadcn Table of upcoming bookings; click row opens detail dialog |
| `src/components/calendar/AppointmentDetailDialog.tsx` | shadcn Dialog: full details, cancel via AlertDialog, reschedule via datetime-local inputs |

### Hooks

| File | Responsibility |
|------|----------------|
| `src/hooks/useBookings.ts` | `useBookings` (ranged fetch), `useUpcomingBookings` (list view), `useCancelBooking`, `useRescheduleBooking` |

## Layout structure

The calendar fills the page below the app header as a flex column inside `PageShell`:

```
┌──────────────────────────────────────────────────┐
│  CalendarToolbar                                 │  — non-scrolling
├──────┬────────────────────────────────────────────┤
│      │  Mon 4  │ Tue 5  │ Wed 6  │ ... │ Sun 10  │  — sticky top-0
│      ├─────────┼────────┼────────┼─────┼─────────┤
│ 00:00│         │        │        │     │         │  ↑
│ 01:00│         │ [appt] │        │     │         │  overflow-y: auto
│  ... │         │        │        │     │         │  ↓
│ 23:00│         │        │        │     │         │
└──────┴─────────┴────────┴────────┴─────┴─────────┘
```

- Outer wrapper: `flex flex-col` filling the viewport height below the app header.
- Day header row: `position: sticky; top: 0; z-index: 10; background: background; border-bottom` —
  stays visible while the time grid scrolls.
- Scrollable body: `flex flex-1 overflow-y-auto` — contains TimeGutter and DayColumns side by side.
- TimeGutter: `w-16 flex-shrink-0`; scrolls with the content (no separate sync required).
- Each DayColumn: `flex-1 relative h-[1536px]` (24 × 64 px).
- On viewports `< 768 px`: columns wrapper gets `min-w-[640px]` and the outer container gets
  `overflow-x: auto` — the week view scrolls horizontally.

## Time grid

Each hour row is **64 px**. Appointment block positioning:

```
top    = (startMinutes / 60) × 64   px    // startMinutes counted from 00:00
height = (durationMinutes / 60) × 64 px
min-height: 24 px                         // enforced so short blocks remain readable
```

Grid lines: 24 `div`s with `position: absolute; top: N × 64 px; width: 100%; border-top`.
Half-hour dividers at `N × 64 + 32 px` use a lighter border color.

### Current-time indicator

A `div` with `position: absolute; top: (currentHour × 60 + currentMinutes) / 60 × 64 px;
left: 0; right: 0; height: 2px; background: red-500`. Rendered only in today's DayColumn.
Updated every minute via `setInterval` in a `useEffect`.

### Scroll-to-current-hour

On mount: `scrollableRef.current.scrollTop = currentHour × 64 − 128` (places current time
~2 hours from the top). If current hour < 6 or > 22, scroll to `8 × 64 = 512` (08:00).

## Overlap layout algorithm

Pure function `computeColumnLayout(appointments)` → `Array<{ appointment, colIndex, colCount }>`:

1. Sort appointments by `startAt` ascending.
2. Greedy column assignment: maintain `columns[]` array; each slot tracks the latest `endAt` seen.
   For each appointment, assign to the first column where `latestEndAt ≤ appointment.startAt`; if
   none exists, push a new column.
3. `colIndex` = index of the assigned column; `colCount` = `columns.length`.
4. CSS applied to the block: `left = (colIndex / colCount) × 100%`,
   `width = (1 / colCount × 100%) − 2px` (2 px gap between adjacent blocks).

O(n²) worst case; n (appointments per day per service) is small in practice.

## Contracts

### URL search params

| Param | Values | Default |
|-------|--------|---------|
| `view` | `week` \| `day` \| `list` | `week` |
| `date` | `YYYY-MM-DD` | today |
| `serviceId` | UUID | absent = all services |

Managed via `useSearchParams` from react-router-dom.

### Hook interfaces

```ts
interface Booking {
  id: string;
  tenantId: string;
  serviceId: string;
  clientName: string;
  clientEmail: string;
  startAt: string;   // ISO 8601 UTC
  endAt: string;     // ISO 8601 UTC
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

// ranged fetch — used by week and day views
function useBookings(params: {
  from: string;       // ISO 8601
  to: string;         // ISO 8601
  serviceId?: string;
}): UseQueryResult<Booking[]>

// open-ended fetch from today — used by list view
function useUpcomingBookings(params: {
  serviceId?: string;
}): UseQueryResult<Booking[]>

function useCancelBooking(): UseMutationResult<Booking, ApiError, string>
// arg: booking id

function useRescheduleBooking(): UseMutationResult<
  Booking,
  ApiError,
  { id: string; startAt: string; endAt: string }
>
```

Both mutations call `PATCH /tenants/:tenantId/bookings/:id` and on success call
`queryClient.invalidateQueries({ queryKey: ['bookings'] })`.

### API calls (no new endpoints)

```
GET   /tenants/:tenantId/bookings?from=<ISO>&to=<ISO>[&serviceId=<uuid>]
GET   /tenants/:tenantId/bookings?from=<today-ISO>[&serviceId=<uuid>]
PATCH /tenants/:tenantId/bookings/:id   body: { status: 'cancelled' }
PATCH /tenants/:tenantId/bookings/:id   body: { startAt: <ISO>, endAt: <ISO> }
GET   /tenants/:tenantId/services       (reuse existing useServices hook)
```

### Route

```
/appointments   → RequireAuth → AppLayout → AppointmentsPage
```

Added alongside existing routes in `App.tsx`. Sidebar "Calendar" link points here.

### Timezone

JavaScript's `new Date(isoString)` parses ISO 8601 UTC strings and converts to the browser's local
timezone automatically. All display formatting (`format(new Date(startAt), 'HH:mm')`) therefore
shows local time without any explicit conversion. A per-tenant timezone setting is post-MVP per the
M4b trade-offs.

## Rejected alternatives

**`react-big-calendar`** — 140 KB+, requires a date adapter, opinionated styles that conflict with
shadcn/Tailwind, and carries drag-and-drop and recurring-event features not needed for MVP.

**`@fullcalendar/react`** — multiple packages, complex licensing per plugin, same style conflict.
Overkill.

**Custom calendar without `date-fns`** — native `Date` arithmetic for week boundaries, day
iteration, and formatting is verbose and a well-known source of off-by-one bugs. `date-fns` is
tree-shakeable; the cost is negligible.

**Shadcn `Tabs` for view toggle** — `Tabs` carries panel semantics (the content panel is the whole
calendar, not a tab panel). A three-button toggle group is semantically correct and requires no new
shadcn component.

**Sticky time gutter (fixed left, separate scroll sync)** — two synchronized scroll containers are
fragile across browsers. Letting the time gutter scroll with the content is simpler; the sticky day
headers give sufficient orientation.

**Separate routes for day/week/list** — URL search params encode all navigation state without
adding route segments. Back-button and share links restore the exact view, date, and filter.

## Trade-offs accepted

- Overlap layout uses a global column count per day column (not per cluster), so non-overlapping
  appointments adjacent in time can appear narrower than necessary. Simpler to implement; acceptable
  at MVP scale.
- The week view scrolls horizontally on narrow viewports rather than adapting the column count.
  A truly responsive calendar grid requires significant extra complexity.
- List view has no pagination. Consistent with M4 and M4b list endpoints; revisit post-MVP.
- No drag-and-drop rescheduling. Reschedule is via a dialog with datetime-local inputs. Post-MVP.

## Out of scope

- Drag-and-drop rescheduling.
- Per-tenant timezone setting.
- Color-coding by service (status-based color is sufficient for MVP).
- Recurring appointment visualization.
- Appointment creation from the calendar (M6).
- Pagination on the list view.
- Export to iCal / Google Calendar.

## Edge cases

| Scenario | Handling |
|----------|----------|
| Overlapping appointments in the same column | Greedy layout — rendered side-by-side |
| Booking shorter than 30 min | `min-height: 24px`; client name only (no time range) |
| Booking spanning midnight | Block rendered on the day of `startAt`; clipped at column bottom |
| Cancel already-cancelled booking | API returns 409; inline error shown in dialog |
| Reschedule with end ≤ start | Client-side validation blocks submit; inline error in dialog |
| Reschedule conflict (409 from API) | Inline error in dialog; dialog stays open |
| Service filter with no matching bookings | Empty columns in calendar; empty state in list |
| No bookings at all in the viewed range | Empty columns — no per-column empty state needed |
| Network error loading bookings | `ErrorState` component with retry action |
| Token expires during session | `apiFetch` throws `ApiError(401)` → existing global `onError` → logout |
| Today not in current view (user navigated away) | Current-time indicator not rendered; no today highlight |
