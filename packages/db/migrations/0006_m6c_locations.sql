-- 1. Create locations table
CREATE TABLE locations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  address    TEXT,
  timezone   TEXT        NOT NULL DEFAULT 'UTC',
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON locations (tenant_id);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY locations_tenant_isolation ON locations
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- 2. Seed a default location per tenant BEFORE FORCE ROW LEVEL SECURITY.
--    FORCE is not yet applied, so this INSERT runs as the table owner without
--    needing app.current_tenant_id to be set.
INSERT INTO locations (tenant_id, name, timezone)
SELECT id, name, 'UTC'
FROM tenants;

ALTER TABLE locations FORCE ROW LEVEL SECURITY;

-- 3. Add location_id to staff (nullable first for backfill).
ALTER TABLE staff ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE RESTRICT;

-- Backfill: staff.location_id → the default location seeded for that tenant.
-- Runs inside a DO block so app.current_tenant_id is set per tenant, satisfying
-- RLS on the staff table (which already has FORCE ROW LEVEL SECURITY from M6b).
DO $$
DECLARE
  t      RECORD;
  loc_id UUID;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.current_tenant_id', t.id::text, true);
    SELECT id INTO loc_id FROM locations WHERE tenant_id = t.id LIMIT 1;
    UPDATE staff SET location_id = loc_id WHERE tenant_id = t.id;
  END LOOP;
END;
$$;

ALTER TABLE staff ALTER COLUMN location_id SET NOT NULL;
CREATE INDEX ON staff (location_id);

-- 4. Add location_id to bookings (nullable first for backfill).
ALTER TABLE bookings ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE RESTRICT;

DO $$
DECLARE
  t      RECORD;
  loc_id UUID;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.current_tenant_id', t.id::text, true);
    SELECT id INTO loc_id FROM locations WHERE tenant_id = t.id LIMIT 1;
    UPDATE bookings SET location_id = loc_id WHERE tenant_id = t.id;
  END LOOP;
END;
$$;

ALTER TABLE bookings ALTER COLUMN location_id SET NOT NULL;
CREATE INDEX ON bookings (location_id);
