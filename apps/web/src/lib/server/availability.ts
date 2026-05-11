import type { PoolClient } from '@neondatabase/serverless';

function slotsForWindows(
  windows: Array<{ start_time: string; end_time: string }>,
  blockOverrides: Array<{ start_time: string; end_time: string }>,
  bookedRows: Array<{ start_at: Date; end_at: Date }>,
  date: string,
  durationMinutes: number,
): Array<{ startAt: string; endAt: string; available: boolean }> {
  const slots: Array<{ startAt: string; endAt: string; available: boolean }> = [];

  for (const window of windows) {
    const [wStartH, wStartM] = window.start_time.split(':').map(Number);
    const [wEndH, wEndM] = window.end_time.split(':').map(Number);
    const windowStartMin = wStartH * 60 + wStartM;
    const windowEndMin = wEndH * 60 + wEndM;

    let cursor = windowStartMin;
    while (cursor + durationMinutes <= windowEndMin) {
      const slotEndCursor = cursor + durationMinutes;
      const blocked = blockOverrides.some(b => {
        const [bH, bM] = b.start_time.split(':').map(Number);
        const [eH, eM] = b.end_time.split(':').map(Number);
        return (bH * 60 + bM) < slotEndCursor && (eH * 60 + eM) > cursor;
      });

      if (!blocked) {
        const slotStart = new Date(`${date}T00:00:00Z`);
        slotStart.setUTCMinutes(slotStart.getUTCMinutes() + cursor);
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);

        const booked = bookedRows.some(
          b => new Date(b.start_at) < slotEnd && new Date(b.end_at) > slotStart,
        );
        slots.push({ startAt: slotStart.toISOString(), endAt: slotEnd.toISOString(), available: !booked });
      }

      cursor += durationMinutes;
    }
  }

  return slots;
}

export async function checkOverlap(
  client: PoolClient,
  serviceId: string,
  start: Date,
  end: Date,
  excludeId?: string,
): Promise<boolean> {
  const values: unknown[] = [serviceId, start, end];
  let sql =
    "SELECT 1 FROM bookings WHERE service_id = $1 AND status != 'cancelled' AND start_at < $3 AND end_at > $2";
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id != $${values.length}`;
  }
  const { rows } = await client.query(sql, values);
  return rows.length > 0;
}

export async function checkStaffOverlap(
  client: PoolClient,
  staffId: string,
  start: Date,
  end: Date,
  excludeId?: string,
): Promise<boolean> {
  const values: unknown[] = [staffId, start, end];
  let sql =
    "SELECT 1 FROM bookings WHERE staff_id = $1 AND status != 'cancelled' AND start_at < $3 AND end_at > $2";
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id != $${values.length}`;
  }
  const { rows } = await client.query(sql, values);
  return rows.length > 0;
}

export async function generateStaffSlots(
  client: PoolClient,
  staffId: string,
  date: string,
  durationMinutes: number,
): Promise<Array<{ startAt: string; endAt: string; available: boolean }>> {
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();

  const { rows: schedules } = await client.query<{ start_time: string; end_time: string }>(
    'SELECT start_time, end_time FROM staff_schedules WHERE staff_id = $1 AND day_of_week = $2 ORDER BY start_time',
    [staffId, dayOfWeek],
  );

  const { rows: addOverrides } = await client.query<{ start_time: string; end_time: string }>(
    `SELECT start_time, end_time FROM staff_schedule_overrides
     WHERE staff_id = $1 AND type = 'available' AND start_date <= $2::date AND end_date >= $2::date`,
    [staffId, date],
  );

  if (schedules.length === 0 && addOverrides.length === 0) return [];

  const { rows: blockOverrides } = await client.query<{ start_time: string; end_time: string }>(
    `SELECT start_time, end_time FROM staff_schedule_overrides
     WHERE staff_id = $1 AND type = 'not_available' AND start_date <= $2::date AND end_date >= $2::date`,
    [staffId, date],
  );

  const { rows: bookedRows } = await client.query<{ start_at: Date; end_at: Date }>(
    `SELECT start_at, end_at FROM bookings
     WHERE staff_id = $1 AND status != 'cancelled'
       AND start_at >= $2::timestamptz
       AND start_at < ($2::date + INTERVAL '1 day')::timestamptz`,
    [staffId, date],
  );

  return slotsForWindows([...schedules, ...addOverrides], blockOverrides, bookedRows, date, durationMinutes);
}

export async function generateAnyAvailableSlots(
  client: PoolClient,
  tenantId: string,
  serviceId: string,
  locationId: string,
  date: string,
  durationMinutes: number,
): Promise<Array<{ startAt: string; endAt: string; available: boolean }>> {
  const { rows: staffRows } = await client.query<{ id: string }>(
    `SELECT s.id FROM staff s
     JOIN staff_services ss ON ss.staff_id = s.id AND ss.service_id = $1
     WHERE s.tenant_id = $2 AND s.location_id = $3 AND s.is_active = true
     ORDER BY s.created_at`,
    [serviceId, tenantId, locationId],
  );

  if (staffRows.length === 0) return [];

  const merged = new Map<string, { startAt: string; endAt: string; available: boolean }>();

  for (const { id: staffId } of staffRows) {
    const staffSlots = await generateStaffSlots(client, staffId, date, durationMinutes);
    for (const slot of staffSlots) {
      const existing = merged.get(slot.startAt);
      if (!existing) {
        merged.set(slot.startAt, { ...slot });
      } else if (slot.available) {
        existing.available = true;
      }
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.startAt.localeCompare(b.startAt));
}
