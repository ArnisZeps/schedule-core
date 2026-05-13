# Requirements: Location Timezone Auto-detect

## User stories

- As a business owner creating a location, I want timezone to be set automatically from my browser, so I don't have to type an IANA timezone string manually.
- As a business owner editing a location, I want the timezone to stay unchanged, so my existing slot generation is not accidentally broken.

## Acceptance criteria

- [ ] The location form has no timezone input field in both create and edit modes.
- [ ] A newly created location is saved with the timezone matching the owner's browser OS timezone at the time of submission.
- [ ] Editing and saving an existing location does not alter its stored timezone.
- [ ] The browser-detected timezone is a valid IANA string accepted by the existing API validator (`Intl.supportedValuesOf('timeZone')`).
