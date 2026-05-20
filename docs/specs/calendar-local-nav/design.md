# Design: calendar-local-nav

## Problem

All calendar navigation (`CalendarToolbar`) calls `router.push`, which triggers a Next.js navigation. Even for same-page URL param changes, Next.js fetches an RSC payload from the server before committing the render. This causes a 200–500 ms delay on every click — visible as a gray opacity animation — even when booking data is already in the React Query cache from `useBookingsPrefetch`.

The delay is in the router, not in data fetching.

## Solution

Move `view`, `dateStr`, `serviceId`, and `staffId` from URL params into `useState` in `AppointmentsPage`. State updates are synchronous React renders — no server round trip. The URL is kept in sync via `router.replace` as a side effect (for back button and direct links), but the URL no longer drives rendering.

## Components

| File | Change |
|------|--------|
| `apps/web/src/page-components/appointments/AppointmentsPage.tsx` | Replace `useSearchParams` reads with `useState`. Initialise state from URL on mount. Add `router.replace` sync effect. Pass nav callbacks to `CalendarToolbar`. Remove `useTransition`/`startNavigation`/`isNavigating`. |
| `apps/web/src/components/calendar/CalendarToolbar.tsx` | Remove `useSearchParams`, `useRouter`, `router.push`. Accept current state and callbacks as props instead. |
| `apps/web/src/components/calendar/WeekView.tsx` | Remove `className` prop (no longer needed for opacity dim). |
| `apps/web/src/components/calendar/DayView.tsx` | Remove `className` prop. |

## Contracts

### `AppointmentsPage` state

```ts
const [view, setView]           = useState<'week' | 'day' | 'list'>()  // init from URL or mobile default
const [dateStr, setDateStr]     = useState<string>()                   // YYYY-MM-DD, init from URL or today
const [serviceId, setServiceId] = useState<string | undefined>()       // init from URL
const [staffId, setStaffId]     = useState<string | undefined>()       // init from URL
```

Initialisation reads `useSearchParams()` once (in the `useState` initialisers). After mount, `useSearchParams` is not used again.

### URL sync effect

```ts
useEffect(() => {
  router.replace(`/appointments?${qs}`, { scroll: false })
}, [view, dateStr, serviceId, staffId])
```

`router.replace` (not `push`) so the back button navigates between viewed dates, not between every intermediate param string.

### `CalendarToolbar` props

```ts
interface CalendarToolbarProps {
  services: Service[]
  staffList?: Staff[]
  view: 'week' | 'day' | 'list'
  dateStr: string
  serviceId?: string
  selectedStaffId?: string
  onNavigate: (direction: 'prev' | 'next' | 'today') => void
  onViewChange: (view: 'week' | 'day' | 'list') => void
  onServiceChange: (serviceId: string | undefined) => void
  onStaffChange: (staffId: string | undefined) => void
  onNewAppointment?: () => void
}
```

`CalendarToolbar` no longer owns any navigation state or routing. It is a pure controlled component.

## Rejected alternatives

**Keep `router.push`, add optimistic local state** — two sources of truth (local + URL). They can diverge on navigation failure or fast clicks. Rejected.

**Use `window.history.replaceState` directly** — bypasses Next.js router; `useSearchParams` may not update. Fragile and undocumented. Rejected.

**Accept the delay, keep URL as source of truth** — user explicitly deprioritised URL shareability in favour of responsiveness. Rejected.

## Trade-offs accepted

- Copying a URL mid-session and sharing it will link to today's week if the recipient opens it fresh (because the URL sync uses `router.replace` with current date, not the viewed date)... actually this is fine — the URL IS updated via the sync effect, so the URL in the address bar always reflects the current view. Direct links still work.
- Browser back button navigates between dates visited during the session (via `router.replace` history entries). This is equivalent to the previous behaviour.

## Out of scope

- `ListView` — uses `useUpcomingBookings` which is independent of `dateStr`; no change required.
- `useBookingsPrefetch` — unchanged.
- Removing SSR `initialData` from `useBookings` — separate concern.

## Edge cases

- **Mobile default**: `useState` initialiser checks `window.matchMedia` — same logic as before, runs once on mount.
- **Invalid URL date**: `parseISO` of a malformed date string falls back gracefully (date-fns returns `Invalid Date`). Add a guard: if `parseISO` result is invalid, fall back to today.
- **Direct link with `?view=day&date=2026-05-26`**: `useState` initialiser reads from `useSearchParams()` synchronously, so the correct date and view are set on first render.
