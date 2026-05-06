**Date:** 2026-04-15
**Status:** Approved for MVP

## Goal

Build ScheduleCore - a multi-tenant SaaS for managing appointments and bookings (barbers, psychologists, beauty procedures, etc.). Service businesses sign up, configure services and availability, clients self-book via hosted page or embeddable widget.

## Approach

Incremental milestone delivery. Get the data model right first - everything else depends on it. Each milestone requires a plan + tests before code.

Stack: pnpm monorepo, Express API (`apps/api`), Vite+React SPA (`apps/web`), Neon serverless PostgreSQL (`packages/db`), Terraform infra.

## Steps

- [x] **M1 - Data model + schema**: Design core tables (tenants, services, availability_rules, bookings). Document in `docs/`. Write ADR if non-obvious multi-tenancy decisions arise.
- [x] **M2 - Migration tooling**: Pick and set up a migration runner. Write ADR (touches DB patterns).
- [x] **M3 - Tenant auth**: Sign-up / login for business owners. JWT or session-based. Needs ADR (auth strategy not documented yet).
- [x] **M4 - Core API surface**: Tenant CRUD, service management, availability config - all behind auth. No UI.
- [x] **M5a - Dashboard shell + configuration UI**: Authenticated web UI shell for business owners — navigation, routing, auth guards, component patterns. Service CRUD, working hours and availability setup. Designed responsive — will be used on phones. Foundation for all subsequent owner-facing features. Note: staff management was deferred — delivered in M6b.
- [x] **M5c - UI polish**: Replace ad-hoc Tailwind with shadcn/ui component system. Design tokens, layout primitives, form validation (RHF + zod), toast feedback, AlertDialog confirmations, skeleton loading states, consistent empty/error states. Goal: professional, sellable UI that future milestones build on.
- [x] **M4b - Bookings API**: Complete bookings API layer — owner-side endpoints (list with date/service filtering, manual create, cancel, reschedule) and the public client-facing endpoint (no-auth POST that validates against availability rules). Foundation for M5b (calendar view), M6 (manual entry UI), and M7 (booking web widget).
- [x] **M5b - Appointment calendar + list**: Day/week calendar view of appointments. Appointment list with cancel/reschedule actions. Builds on the shell and patterns established in M5a.
- [x] **M6 - Manual appointment entry**: "New Appointment" button + click-drag on the calendar opens a slide-over form for logging phone bookings. Pick service, date/time slot, client name + phone (mandatory) + email (optional). Shows taken slots and conflict warning to prevent accidental double-booking; override checkbox allows intentional double-booking. Internal notes field. Target: completable in under 30 seconds. No client account creation required. Note: staff selection was omitted — added in M6d.
- [ ] **M6b - Staff**: Introduce staff as a first-class entity. Schema: `staff` table (name, email, phone, tenant_id, is_active), `staff_services` junction (which staff can perform which service), `staff_schedules` (recurring weekly working hours per staff member), `staff_schedule_overrides` (one-off date-level exceptions: days off, adjusted hours). API: full CRUD for staff, endpoints to assign/unassign services, set and update schedules and overrides. Owner UI: staff list, create/edit staff profile, service assignment checkboxes, weekly working hours configurator, override management. Builds on the shadcn/ui patterns from M5c.
- [ ] **M6c - Locations**: Introduce business locations as a first-class concept. A business can have one or more named locations (e.g. "Main Street Branch", "Old Town"). Each staff member is assigned to exactly one location. Appointments and availability are scoped by location. Owner UI: location CRUD (name, address, timezone), staff reassignment to a location. API: location-aware endpoints for staff and availability queries. Migration adds `locations` table and `location_id` (non-nullable) to `staff` and `appointments`; single-location businesses get a default location seeded automatically. M7's public booking flow will use location as the first step when a business has more than one.
- [ ] **M6d - Manual appointment entry: staff selection**: Extend the M6 manual entry slide-over to include staff selection. After picking a service, the owner selects a staff member from those qualified for that service (via `staff_services`). Available time slots then reflect that staff member's schedule and existing appointments. If the owner selects "any available", the system assigns the first free qualified staff member. Updates `appointments.staff_id` (non-nullable going forward). Requires M6b and M6c to be complete.
- [ ] **M7 - Booking web widget**: Build the client-facing booking UI as a self-contained React component/flow — optional location selection (shown only for multi-location businesses), service selection, staff selection (specific person or "any available"), date/time picker showing available slots based on selected staff, client details form, confirmation screen. Calls the public endpoint from M4b. No client account creation required. Routed at `/book/:tenantSlug` inside the existing `apps/web` — no special domain or hosting decisions yet. M8 and M9 handle distribution.
- [ ] **M8 - Hosted booking page**: Give M7's UI a proper public URL on a dedicated per-tenant subdomain (e.g. `acme.schedulecore.com`). This is where the domain/routing strategy gets decided and implemented.
- [ ] **M9 - Embeddable widget**: Wrap M8's hosted URL in an `<iframe>` and generate a copy-paste tag for businesses to embed on their own sites. No JS injection, no shadow DOM. Businesses copy-paste the tag into their site HTML.

## Post-MVP

- Email notifications — appointment confirmations and reminders for clients.
- Statistics and analytics — revenue reporting, no-show tracking, client history. Prioritise once businesses reach meaningful booking volume.
- SMS notifications.
- Recurring appointments.
- Mobile app — revisit only when revenue justifies a second codebase.

## Open questions

- Row-level vs schema-level multi-tenancy? (affects M1 heavily): Row level
- Auth strategy: JWT stateless vs session + Redis?: JWT stateless
- Should the public booking page be SSR or SPA? revisit ADR-003 for SEO needs: 
- Notification system (email confirmations) - in scope for MVP?