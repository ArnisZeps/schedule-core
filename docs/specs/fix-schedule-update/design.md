# Design — fix/schedule-update

## Root cause

`LocalWindow._key` is a module-level incrementing counter (`nextKey()`). Every time `useEffect([fetched])` fires in `WeeklyScheduleCalendar`, all windows are rebuilt with brand-new `_key` values:

```ts
// WeeklyScheduleCalendar.tsx
useEffect(() => {
  if (fetched) {
    setWindows(fetched.map(w => ({ ...w, _key: nextKey() })))  // keys always reassigned
  }
}, [fetched])
```

`handlePanelUpdate` and `handlePanelDelete` look up windows by `_key`. If a refetch completes while the panel is open (or before the user clicks Update the second time), the `_key` captured at panel-open time is gone; the lookup returns `undefined` and the function silently returns.

### Reproduction sequence

1. User opens panel for window — captures `_key = N`
2. Panel closes; `autoSave` fires → mutation succeeds → `invalidateQueries` → background refetch starts
3. User reopens the panel quickly (refetch still in flight)
4. Refetch resolves → `useEffect` runs → all keys reassigned (N is now gone)
5. User clicks "Update" → `handlePanelUpdate(N, ...)` → `windows.find(key = N)` → `undefined` → no-op

### Why server `id` is not a stable alternative

`PUT /schedules` is a full replace: it `DELETE`s all rows then re-`INSERT`s them, so Postgres generates new UUIDs on every save. The `id` changes with each PUT, making it equally transient to `_key`.

## Fix

The panel already has all the information needed: `panelState.window` captures the window's state at the moment the panel opened (`dayOfWeek`, `startTime`, `endTime`). Overlap validation guarantees no two windows share the same `(dayOfWeek, startTime, endTime)` triple, so this triple uniquely identifies the target window regardless of what `_key` is assigned.

`handlePanelUpdate` and `handlePanelDelete` should read from `panelState` directly rather than relying on a key parameter passed through the panel callback.

### Changes

**`apps/web/src/components/staff/WeeklyScheduleCalendar.tsx`**

Remove `key` from `handlePanelUpdate` / `handlePanelDelete` signatures; look up the target by matching the snapshot in `panelState.window`:

```ts
function handlePanelUpdate(startTime: string, endTime: string) {
  const win = panelState?.window
  if (!win) return
  const target = windows.find(
    w => w.dayOfWeek === win.dayOfWeek && w.startTime === win.startTime && w.endTime === win.endTime
  )
  if (!target) {
    toast.error('Could not find schedule window to update')
    return
  }
  if (hasOverlap(windows, target.dayOfWeek, startTime, endTime, target._key)) {
    toast.error('Time window overlaps an existing one')
    return
  }
  const updated = windows.map(w => w === target ? { ...w, startTime, endTime } : w)
  setWindows(updated)
  setPanelState(null)
  autoSave(updated)
}

function handlePanelDelete() {
  const win = panelState?.window
  if (!win) return
  const updated = windows.filter(
    w => !(w.dayOfWeek === win.dayOfWeek && w.startTime === win.startTime && w.endTime === win.endTime)
  )
  setWindows(updated)
  setPanelState(null)
  autoSave(updated)
}
```

**`apps/web/src/components/staff/ScheduleWindowPanel.tsx`**

Simplify callback signatures — `key` is no longer needed:

```ts
onUpdate: (startTime: string, endTime: string) => void
onDelete: () => void

// in onSubmit:
onUpdate(values.startTime, values.endTime)
// in delete handler:
onDelete()
```

No changes to `LocalWindow` or `WeekdayColumn`.

## Out of scope

- Race condition when two mutations fire in parallel (existing behaviour, not made worse)
- Server-side overlap validation (no DB constraint; out of scope per existing design)

## Rejected alternatives

**Stable server `id`** — `PUT /schedules` does DELETE + re-INSERT on every save, regenerating all UUIDs. `id` is as transient as `_key`.

**Preserve `_key` across refetches** — Map fetched windows back to existing `_key` values by content equality. This works only if local and server state are identical at refetch time, which is a fragile assumption during rapid edits.

**Change PUT to upsert** — Would require a unique constraint on `(staff_id, day_of_week, start_time)` and more complex SQL. Out of scope for a bug fix; the content-match approach is sufficient.
