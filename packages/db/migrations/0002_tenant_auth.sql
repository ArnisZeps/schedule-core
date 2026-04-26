-- M3: tenant auth
-- Adds: users table, schedulecore_app app role, FORCE RLS on tenant-scoped tables.
-- See docs/adr/007-auth-strategy.md and docs/features/m3-tenant-auth/design.md.

-- ---------------------------------------------------------------------------
-- users
-- Platform-level auth table. No RLS — login looks up by email without a
-- tenant context; keeping it owner-controlled avoids a chicken-and-egg problem.
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON users (email);

-- ---------------------------------------------------------------------------
-- schedulecore_app role
-- Non-owner application role required for RLS enforcement (ADR-005).
-- Table owners bypass RLS by default; the app must connect as this role in
-- staging/production. Password is set out-of-band (Neon console / Terraform).
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'schedulecore_app') THEN
    CREATE ROLE schedulecore_app WITH LOGIN NOINHERIT;
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  tenants, users, resources, availability_rules, bookings
  TO schedulecore_app;

-- schema_migrations is infrastructure; the app role has no need to access it.

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO schedulecore_app;

-- ---------------------------------------------------------------------------
-- FORCE ROW LEVEL SECURITY
-- Enforces tenant isolation even for the table owner role.
-- Policy shape is defined in migration 0001 (USING + WITH CHECK on tenant_id).
-- ---------------------------------------------------------------------------

ALTER TABLE resources          FORCE ROW LEVEL SECURITY;
ALTER TABLE availability_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE bookings           FORCE ROW LEVEL SECURITY;
