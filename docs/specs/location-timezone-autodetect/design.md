# Design: Location Timezone Auto-detect

## Problem

`LocationForm` renders a free-text timezone `<Input>` that requires the owner to type a valid IANA timezone string (e.g. `Europe/Riga`). The field is validated at the API layer against `Intl.supportedValuesOf('timeZone')`. For the common case — a single-location business whose owner is physically at the location — this is unnecessary friction. The browser already knows the correct timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`, which returns a valid IANA string unaffected by VPN (it reads the OS clock setting, not the network location).

## Components

| File | Change |
|------|--------|
| `apps/web/src/components/locations/LocationForm.tsx` | Remove timezone `<FormField>`. Change default for `timezone` from `'UTC'` to `Intl.DateTimeFormat().resolvedOptions().timeZone`. |

No other files change. `LocationDetailPage.tsx` already passes `location.timezone` as `defaultValues.timezone` for the edit case — this continues to work unchanged, sending the stored value back on save.

## Contracts

No API or data model changes. `LocationFormValues` retains the `timezone` field — it is simply not rendered. The form continues to submit timezone transparently on both create and update:

- **Create** (`POST /locations`): `timezone` is populated from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- **Update** (`PATCH /locations/:id`): `timezone` echoes back the value from `location.timezone` passed in via `defaultValues`.

The API contract in `docs/domains/locations.md` is unchanged.

## Rejected alternatives

**Timezone dropdown (searchable select)** — still adds UX friction for the common case; deferred to a future enhancement if multi-timezone businesses become a real use case.

**Remove timezone from `LocationFormValues` entirely and detect it in `handleSave`** — changes the call site and the form contract for no benefit; keeping `timezone` as a hidden form field is the smaller, safer change.

**Remove timezone from the API (make it optional, always default to UTC)** — breaks slot generation for businesses not in UTC. The field must stay in the data model.

## Trade-offs accepted

A business owner cannot change a location's timezone from the UI after creation. If an owner creates a location while travelling (OS timezone ≠ location timezone), they get the wrong value with no way to correct it from this form. Accepted for MVP; a timezone edit control can be added to the detail page later if needed.

## Out of scope

- Timezone edit UI for existing locations.
- Address-based timezone detection (geocoding).
- Surfacing the stored timezone as read-only text on the detail page.

## Edge cases

- `Intl.DateTimeFormat` is available in all browsers targeted by the app. No fallback is needed; if somehow unavailable, `'UTC'` is the hardcoded schema default and the API accepts it.
- The returned timezone string is always in `Intl.supportedValuesOf('timeZone')`, so API validation always passes.
