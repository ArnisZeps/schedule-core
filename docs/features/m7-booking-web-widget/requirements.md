# Requirements: m7-booking-web-widget

## User stories

- As a client, I want to select my preferred location (when a business has multiple branches), so that I book at the right site.
- As a client, I want to browse the available services and pick the one I need, so that the appointment is for the correct type of work.
- As a client, I want to choose a specific staff member or let the business assign whoever is free, so that I can book with a preferred person or just take the first available slot.
- As a client, I want to see available dates and time slots and pick one that fits my schedule, so that I can confirm a specific time.
- As a client, I want to enter my name and contact details in a short form, so that the business can reach me about the appointment.
- As a client, I want to see a confirmation screen with my booking details, so that I know the booking was accepted.
- As a business owner, I want the booking page to load fast and be fully indexed by search engines, so that clients on slow connections can book without friction and the page is discoverable.

## Acceptance criteria

### Location section
- [ ] Hidden for single-location tenants; displayed only when the tenant has 2+ active locations
- [ ] All active locations shown as selectable cards (name, address)
- [ ] Selected location is visually highlighted
- [ ] Staff and Date/Time sections show placeholder state until a location is selected (multi-location only)

### Service section
- [ ] All tenant services listed as cards (name, description, duration)
- [ ] Selected service visually highlighted
- [ ] Staff section becomes interactive after a service is selected

### Staff section
- [ ] "Any available" option is always listed first, regardless of how many staff members exist
- [ ] All active staff qualified for the selected service at the selected location listed as cards
- [ ] Selected staff (or "any available") visually highlighted
- [ ] Shows placeholder state when no service selected
- [ ] Date/Time section becomes interactive after a staff selection is made

### Date/Time section
- [ ] Date strip shows 7 days at a time with prev/next navigation; window spans at least 60 days from today
- [ ] Selecting a date fetches and displays available time slot buttons
- [ ] Unavailable slots (all qualified staff booked) shown as disabled buttons
- [ ] Empty state shown when no slots are available on the selected date
- [ ] Selected slot visually highlighted
- [ ] Shows placeholder state when no staff selected

### Details section and submit
- [ ] Fields: client name (required), phone (required, min 7 chars), email (optional, valid format)
- [ ] Inline validation messages shown on invalid submit attempt
- [ ] Submit button disabled until service, staff, slot, name, and phone are all provided
- [ ] Loading state on submit button while request is in flight

### Confirmation screen
- [ ] Replaces the booking form after a successful submission
- [ ] Shows: service name, staff name (or "Any staff member"), date and time in location's timezone, location name (only for multi-location tenants), booking reference ID
- [ ] "Book another appointment" link resets the widget to its initial state

### Floating nav (mobile only)
- [ ] Visible only on mobile viewports (hidden at md breakpoint and above)
- [ ] Fixed to the right edge of the screen, vertically centered
- [ ] One circular pill button per section (location if multi, service, staff, time)
- [ ] Buttons are half-transparent (backdrop-blur) by default; active section pill at full opacity
- [ ] Clicking a pill smooth-scrolls to that section

### Error and edge-case handling
- [ ] Unknown tenant slug renders the Next.js 404 page
- [ ] Slot taken between selection and submit: "This time was just taken. Please select another slot." — selected slot is cleared
- [ ] Rate limited (429): "Too many requests. Please wait a moment and try again."
- [ ] Tenant has no active services: empty state message in service section, no submission possible
