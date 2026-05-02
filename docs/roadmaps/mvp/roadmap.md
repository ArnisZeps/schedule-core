**Date:** 2026-04-15
**Status:** Approved for MVP

## Goal

Build ScheduleCore - a multi-tenant SaaS for managing appointments and bookings (barbers, psychologists, beauty procedures, etc.). Service businesses sign up, configure resources and availability, clients self-book via hosted page or embeddable widget.

## Approach

Incremental milestone delivery. Get the data model right first - everything else depends on it. Each milestone requires a plan + tests before code.

Stack: pnpm monorepo, Express API (`apps/api`), Vite+React SPA (`apps/web`), Neon serverless PostgreSQL (`packages/db`), Terraform infra.

## Steps

- [x] **M1 - Data model + schema**: Design core tables (tenants, resources, availability_rules, bookings). Document in `docs/`. Write ADR if non-obvious multi-tenancy decisions arise.
- [x] **M2 - Migration tooling**: Pick and set up a migration runner. Write ADR (touches DB patterns).
- [x] **M3 - Tenant auth**: Sign-up / login for business owners. JWT or session-based. Needs ADR (auth strategy not documented yet).
- [x] **M4 - Core API surface**: Tenant CRUD, resource management, availability config - all behind auth. No UI.
- [x] **M5a - Dashboard shell + configuration UI**: Authenticated web UI shell for business owners — navigation, routing, auth guards, component patterns. Service and staff CRUD, working hours and availability setup. Designed responsive — will be used on phones. Foundation for all subsequent owner-facing features.
- [x] **M5c - UI polish**: Replace ad-hoc Tailwind with shadcn/ui component system. Design tokens, layout primitives, form validation (RHF + zod), toast feedback, AlertDialog confirmations, skeleton loading states, consistent empty/error states. Goal: professional, sellable UI that future milestones build on.
- [ ] **M4b - Bookings API**: Complete bookings API layer — owner-side endpoints (list with date/resource filtering, manual create, cancel, reschedule) and the public client-facing endpoint (no-auth POST that validates against availability rules). Foundation for M5b (calendar view), M6 (manual entry UI), and M7 (booking web widget).
- [ ] **M5b - Appointment calendar + list**: Day/week calendar view of appointments. Appointment list with cancel/reschedule actions. Builds on the shell and patterns established in M5a.
- [ ] **M6 - Manual appointment entry**: "New Appointment" action inside the dashboard for logging phone bookings. Pick service, staff, date/time, client name + phone. Must show existing bookings to prevent double-booking. Target: completable in under 30 seconds. No client account creation required.
- [ ] **M7 - Booking web widget**: Simple client-facing booking UI — resource selection, date/time picker showing available slots, confirmation screen. Calls the public endpoint from M4b. No client account creation required.
- [ ] **M8 - Hosted booking page**: Per-tenant public page for clients.
- [ ] **M9 - Embeddable widget**: iframe-based booking widget that businesses embed on their own sites. Generates a per-tenant `<iframe>` tag pointing to a hosted booking URL. No JS injection, no shadow DOM. Businesses copy-paste the tag into their site HTML.

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