-- Rename resources table to services.
-- resources = physical bookable things (post-MVP); services = bookable offerings (haircut, massage, etc.)
ALTER TABLE resources RENAME TO services;
ALTER TABLE availability_rules RENAME COLUMN resource_id TO service_id;
ALTER TABLE bookings RENAME COLUMN resource_id TO service_id;
