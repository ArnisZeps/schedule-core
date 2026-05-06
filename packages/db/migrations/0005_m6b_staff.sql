CREATE TABLE staff (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  email      TEXT,
  phone      TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON staff (tenant_id);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_tenant_isolation ON staff
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE staff FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------

CREATE TABLE staff_services (
  staff_id   UUID NOT NULL REFERENCES staff(id)    ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);

CREATE INDEX ON staff_services (tenant_id);

ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_services_tenant_isolation ON staff_services
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE staff_services FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------

CREATE TABLE staff_schedules (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID      NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  tenant_id   UUID      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week SMALLINT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME      NOT NULL,
  end_time    TIME      NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_time < end_time)
);

CREATE INDEX ON staff_schedules (staff_id);
CREATE INDEX ON staff_schedules (tenant_id);

ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_schedules_tenant_isolation ON staff_schedules
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE staff_schedules FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------

CREATE TABLE staff_schedule_overrides (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_date DATE        NOT NULL,
  end_date   DATE        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('available', 'not_available')),
  start_time TIME        NOT NULL,
  end_time   TIME        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_date <= end_date),
  CHECK (start_time < end_time)
);

CREATE INDEX ON staff_schedule_overrides (staff_id);
CREATE INDEX ON staff_schedule_overrides (tenant_id);
CREATE INDEX ON staff_schedule_overrides (staff_id, start_date, end_date);

ALTER TABLE staff_schedule_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_schedule_overrides_tenant_isolation ON staff_schedule_overrides
  USING     (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE staff_schedule_overrides FORCE ROW LEVEL SECURITY;
