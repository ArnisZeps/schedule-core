# Requirements: m5a-dashboard-shell

## User stories

- As a business owner, I want to log in with my email and password so that I can access my dashboard.
- As a business owner, I want to be redirected to login if I am not authenticated so that my data is protected.
- As a business owner, I want to see and manage all my services so that I can control what clients can book.
- As a business owner, I want to set weekly availability windows per service so that bookings are only accepted during working hours.
- As a business owner, I want the UI to work on my phone so that I can manage my schedule on the go.

## Acceptance criteria

### Auth
- [ ] Visiting any protected route without a valid JWT redirects to /login.
- [ ] After successful login the user is redirected to /services (or the originally requested path if stored).
- [ ] Invalid credentials display an inline error message without a page reload.
- [ ] Clicking logout clears the stored token and redirects to /login.
- [ ] A token that has expired mid-session causes the next API call to clear the token and redirect to /login.

### Shell
- [ ] Authenticated pages render inside a shared layout with a navigation sidebar.
- [ ] Sidebar shows at minimum: Services link.
- [ ] On mobile viewports (< 768 px) the sidebar is hidden by default and toggled via a hamburger button in the header.

### Services
- [ ] /services lists all services for the authenticated tenant with name and description.
- [ ] Empty state shown when no services exist.
- [ ] "New service" navigates to a create form.
- [ ] Submitting the create form adds the service and returns to the list.
- [ ] Clicking a service navigates to an edit form pre-populated with current values.
- [ ] Submitting the edit form updates the service in place.
- [ ] Delete prompts confirmation then removes the service from the list.
- [ ] Attempting to delete a service that has bookings shows the server error inline.

### Availability rules
- [ ] Each service has an /availability sub-page reachable from its edit form.
- [ ] The availability page shows a weekly grid (Mon–Sun) with existing time windows.
- [ ] "Add window" opens an inline form to pick day, start time, and end time.
- [ ] Submitting the form adds the window to the grid.
- [ ] Overlapping windows are rejected by the server; the error is shown inline.
- [ ] Deleting a window removes it from the grid.

### Quality
- [ ] pnpm typecheck passes with zero errors.
- [ ] All RTL + MSW tests are green.
- [ ] No console errors on any happy-path flow.
