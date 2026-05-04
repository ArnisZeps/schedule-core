-- services: duration required for slot grid and M7 widget
ALTER TABLE services ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 30;

-- bookings: phone mandatory, notes internal, email now optional
ALTER TABLE bookings ADD COLUMN client_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN notes TEXT;
ALTER TABLE bookings ALTER COLUMN client_email DROP NOT NULL;
-- remove temporary default so new rows must supply a real value
ALTER TABLE bookings ALTER COLUMN client_phone DROP DEFAULT;
