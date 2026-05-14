# Requirements — fix/schedule-update

## Problem

Updating a weekly schedule window succeeds once, but a second update (on any window) has no effect and shows no error. Internally, `handlePanelUpdate` silently no-ops because the `_key` it receives no longer exists in the `windows` array.

## User story

As a business owner editing my staff's weekly schedule, I can update any time window multiple times in a row and each change is saved correctly.

## Acceptance criteria

- AC1: Updating the same window twice in succession persists both changes.
- AC2: Updating two different windows back-to-back persists both changes.
- AC3: No silent failures — if a save cannot find the target window, an error toast is shown.
- AC4: Delete and create operations are unaffected.
