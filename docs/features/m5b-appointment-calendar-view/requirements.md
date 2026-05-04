# Requirements: m5b-appointment-calendar-view

## User stories

- As a business owner, I want to see all appointments for the week in a calendar grid so that I can understand my schedule at a glance.
- As a business owner, I want to switch to a single-day view so that I can see detailed time slots for one day.
- As a business owner, I want a list view of upcoming appointments so that I can scan them in tabular format.
- As a business owner, I want to navigate between weeks and days so that I can browse past and future bookings.
- As a business owner, I want to filter appointments by service so that I can focus on a specific service.
- As a business owner, I want to click an appointment to see its details so that I can review client information and status.
- As a business owner, I want to cancel an appointment from the detail dialog so that I can remove it from the schedule.
- As a business owner, I want to reschedule an appointment from the detail dialog so that I can move it to a new time.
- As a business owner, I want a "Calendar" link in the sidebar so that I can reach the calendar from anywhere in the dashboard.

## Acceptance criteria

### Toolbar
- [ ] View defaults to "week" centered on the current week.
- [ ] "Today" button navigates back to the current week (or day in day view).
- [ ] Prev/next arrows shift by one week in week view, one day in day view.
- [ ] View toggle switches between Week, Day, and List.
- [ ] Service dropdown lists all tenant services; "All services" is the default; selecting one filters the active view.
- [ ] Active view, current date, and selected service are reflected in URL search params (`view`, `date`, `serviceId`).

### Week view
- [ ] Displays Mon–Sun columns with day-of-week + date labels.
- [ ] Left time gutter shows labels for all 24 hours (00:00–23:00).
- [ ] Today's column has a distinct background highlight.
- [ ] A current-time red indicator line is visible in today's column.
- [ ] On mount, the scroll position is set to the current hour (or 08:00 if before 06:00 or after 22:00).
- [ ] Each appointment is rendered as an absolutely-positioned block sized by its start/end time.
- [ ] Block shows client name and time range; bookings shorter than 30 min show client name only.
- [ ] Block color reflects status: amber = pending, blue = confirmed, muted/gray = cancelled.
- [ ] Overlapping appointments in the same column are shown side-by-side without occlusion.
- [ ] Clicking a block opens the detail dialog.

### Day view
- [ ] Same time grid and block behavior as week view, single column for the selected date.
- [ ] Column header shows the full date.

### List view
- [ ] Renders a table with columns: Date, Time, Client, Service, Status.
- [ ] Fetches all upcoming bookings from today forward (no upper bound).
- [ ] Status rendered as a shadcn Badge: amber = pending, blue = confirmed, muted = cancelled.
- [ ] Clicking a row opens the detail dialog.
- [ ] Shows "No upcoming appointments" empty state when the table is empty.

### Appointment detail dialog
- [ ] Shows: client name, email, service name, date, time range, status Badge.
- [ ] Cancel button is visible for non-cancelled appointments; pressing it opens an AlertDialog for confirmation.
- [ ] Confirming cancellation sends `PATCH /tenants/:tenantId/bookings/:id` with `{ status: "cancelled" }`.
- [ ] Reschedule section exposes `datetime-local` inputs for new start and end; submitting sends `PATCH` with `{ startAt, endAt }`.
- [ ] End must be after start; mismatched inputs show an inline validation error before submitting.
- [ ] A 409 conflict response shows an inline error in the dialog; the dialog stays open.
- [ ] Success closes the dialog, invalidates the bookings query, and shows a sonner toast.

### Sidebar
- [ ] Sidebar shows a "Calendar" link (CalendarDays icon) that navigates to `/appointments`.

### Quality
- [ ] `pnpm typecheck` passes with zero errors.
- [ ] All RTL + MSW tests are green.
- [ ] No console errors on any happy-path flow.
- [ ] Playwright browser verification covers: week view render, day view, list view, cancel, and reschedule flows.
