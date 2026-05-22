# Design: fix-location-dropdown-flash

## Problem

`NewAppointmentPanel` calls `useLocations()` with no arguments. This produces query key `['locations', tenantId, { includeInactive: false }]`. `AppointmentsPage` calls `useLocations(true, initialLocations)`, which produces key `['locations', tenantId, { includeInactive: true }]`. These are **different cache entries** — the panel's key has no seeded data and fires a fresh network request on every panel open.

While that fetch is in flight (~200–300 ms), `locations = []` → `activeLocations = []` → `showLocationPicker = false`. The Location dropdown is not rendered. When the response arrives the data populates, `showLocationPicker` flips to `true`, and the dropdown pops into view — causing a visible layout shift.

`AppointmentsPage` already receives SSR-preloaded `initialLocations` (including inactive) and holds the resolved `locations` array in scope. The panel only needs that data passed down as a prop. No new queries, no cache manipulation, no extra fetch.

---

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/src/components/calendar/NewAppointmentPanel.tsx` | Replace internal `useLocations()` call with a `locations: Location[]` prop |
| `apps/web/src/page-components/appointments/AppointmentsPage.tsx` | Pass `locations` to `<NewAppointmentPanel>` |

---

## Contracts

### `NewAppointmentPanel` props (delta)

```ts
// Before
interface NewAppointmentPanelProps {
  services: Service[]
  prefillStart?: Date
  prefillEnd?: Date
  onClose: () => void
}

// After
interface NewAppointmentPanelProps {
  services: Service[]
  locations: Location[]   // full list, including inactive; panel filters internally
  prefillStart?: Date
  prefillEnd?: Date
  onClose: () => void
}
```

The panel continues to derive `activeLocations = locations.filter(l => l.isActive)` and `showLocationPicker = activeLocations.length > 1` from the prop — no logic change.

The `useLocations` import and hook call are removed from `NewAppointmentPanel`.

### `AppointmentsPage` (delta)

Pass the already-resolved `locations` array to the panel:

```tsx
<NewAppointmentPanel
  services={services}
  locations={locations}   // ← new
  prefillStart={prefillStart}
  prefillEnd={prefillEnd}
  onClose={handleClosePanel}
/>
```

`locations` comes from `const { data: locations = [] } = useLocations(true, initialLocations)` which is already seeded at SSR time and available synchronously on first render.

---

## Rejected alternatives

**Seed the `{ includeInactive: false }` cache key from `AppointmentsPage`** — would require a second `setQueryData` call on the parent for a query the panel no longer needs to own. Adds complexity with no benefit over prop-passing. Rejected.

**Align `NewAppointmentPanel` to call `useLocations(true)` and rely on cross-key cache sharing** — React Query does not share data across different keys; `{ includeInactive: false }` and `{ includeInactive: true }` are always separate entries. Rejected.

**Add `staleTime: Infinity` to `useLocations`** — does not fix the cold-cache first-load case (first page visit); the flash still occurs. Rejected.

**Seed via the same `initialData` option already used for staff** — `useLocations` already supports `initialData` but only when the caller passes it. The panel is called without `initialData` today, and the query key mismatch means even adding it would require the panel to know the correct `includeInactive` flag — coupling it to the parent's choice. Prop-passing is cleaner. Rejected.

---

## Trade-offs accepted

- `NewAppointmentPanel` now depends on the caller to supply location data. It can no longer be mounted standalone without a `locations` prop. This is acceptable — the panel is a dashboard-only component always rendered inside `AppointmentsPage`.

---

## Out of scope

- Seeding slot data — slots depend on a selected date and cannot be pre-computed at panel-open time.
- Propagating location data to other dialogs (e.g. `AppointmentDetailDialog`) — that component already receives `locations` as a prop from `AppointmentsPage`.

---

## Edge cases

- **Single-location tenant:** `activeLocations.length === 1` → `showLocationPicker = false`, auto-select logic unchanged. Location is set via `useEffect` on first render, same as today.
- **Zero active locations:** `activeLocations = []` → picker hidden, `locationId` stays `''`. Submit validation (`showLocationPicker && !locationId`) does not fire. Booking proceeds with no location — same behaviour as before.
- **Locations change between SSR render and panel open:** `AppointmentsPage` holds the live React Query result; `useLocations` with SSR seed considers data stale immediately and re-fetches in the background. By the time a user opens the panel the background refresh has typically completed. Edge cases where a location was added or deactivated between SSR and background-refresh resolution are acceptable — the next panel open gets the current data.
