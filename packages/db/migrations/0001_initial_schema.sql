-- ScheduleCore core schema
-- Multi-tenancy: row-level isolation via tenant_id + RLS (see docs/adr/005-multi-tenancy.md)
-- All timestamps are stored in UTC (TIMESTAMPTZ).

-- ---------------------------------------------------------------------------
-- tenants
-- Platform-level table. No RLS — access controlled by auth layer.
-- ---------------------------------------------------------------------------

CREATE TABLE tenants (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- resources
-- Bookable entities within a tenant (staff member, chair, room, etc.).
-- ---------------------------------------------------------------------------

CREATE TABLE resources (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON resources (tenant_id);

-- ---------------------------------------------------------------------------
-- availability_rules
-- Weekly repeating schedule for a resource.
-- day_of_week: 0 = Sunday, 6 = Saturday.
-- tenant_id is denormalised for efficient RLS filtering without a join.
-- ---------------------------------------------------------------------------

CREATE TABLE availability_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_id UUID        NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  day_of_week SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME        NOT NULL,
  end_time    TIME        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_time_order CHECK (start_time < end_time)
);

CREATE INDEX ON availability_rules (resource_id);
CREATE INDEX ON availability_rules (tenant_id);

-- ---------------------------------------------------------------------------
-- bookings
-- An appointment made by a client for a resource.
-- ON DELETE RESTRICT on both FKs — booking history must be preserved.
-- ---------------------------------------------------------------------------

CREATE TABLE bookings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id)   ON DELETE RESTRICT,
  resource_id  UUID        NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  client_name  TEXT        NOT NULL,
  client_email TEXT        NOT NULL,
  start_at     TIMESTAMPTZ NOT NULL,
  end_at       TIMESTAMPTZ NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_time_order CHECK (start_at < end_at)
);

CREATE INDEX ON bookings (tenant_id);
CREATE INDEX ON bookings (resource_id);
CREATE INDEX ON bookings (tenant_id, start_at, end_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Enabled on all tenant-scoped tables.
-- The application must SET LOCAL app.current_tenant_id = '<uuid>' inside
-- a transaction before any tenant-scoped query.
-- NOTE: Table owners bypass RLS by default. A non-owner app role is required
-- for full enforcement — introduced in M3 (tenant auth).
-- ---------------------------------------------------------------------------

ALTER TABLE resources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings           ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON resources
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON availability_rules
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON bookings
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
