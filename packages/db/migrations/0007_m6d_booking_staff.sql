-- 1. Add staff assignment to bookings
ALTER TABLE bookings ADD COLUMN staff_id UUID REFERENCES staff(id) ON DELETE RESTRICT;
CREATE INDEX ON bookings (staff_id);

-- 2. Drop availability_rules — slot generation now uses staff_schedules exclusively
DROP TABLE availability_rules;
