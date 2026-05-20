# Requirements: staff-preload

## User stories

- As a business owner creating a new appointment, I want the staff dropdown to be populated immediately when I select a service and location, so that I do not see an empty list or loading state before I can continue.

## Acceptance criteria

- [ ] After selecting service + location in the New Appointment panel, the staff dropdown renders with options immediately — no empty state, no loading spinner on first open.
- [ ] The staff shown in the dropdown matches exactly what `GET /services/:serviceId/staff?locationId` returns: active staff assigned to the selected service at the selected location.
- [ ] Staff data remains reactive: after any staff create/update/deactivate mutation, the next page load reflects the updated assignments (stale cache is not silently used forever).
- [ ] No regression: `useServiceStaff` re-fetching and mutation invalidation behavior are unchanged.
- [ ] Single-location tenants (location picker hidden) see the staff list immediately upon service selection.
