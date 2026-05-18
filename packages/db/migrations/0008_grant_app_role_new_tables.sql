-- Migration 0002 (M3) created schedulecore_app and granted it access to the
-- original tables (services, availability_rules, bookings, tenants, users).
-- Migrations 0005 and 0006 added staff, staff_services, staff_schedules,
-- staff_schedule_overrides, and locations but never extended those grants.
--
-- Without these grants, withTenantContext cannot switch to schedulecore_app
-- (SET LOCAL ROLE) because queries on the new tables would fail with
-- "permission denied".
--
-- GRANT ... TO CURRENT_USER allows the database owner role (the one used for
-- migrations and historically for the app) to issue SET LOCAL ROLE
-- schedulecore_app inside transactions. The owner connects with BYPASSRLS, so
-- downgrading to schedulecore_app within withTenantContext is what makes RLS
-- actually apply.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  staff, staff_services, staff_schedules, staff_schedule_overrides, locations
  TO schedulecore_app;

GRANT schedulecore_app TO CURRENT_USER;
