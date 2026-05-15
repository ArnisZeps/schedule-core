import type { PoolClient } from '@neondatabase/serverless';
import { clipOverrideWindow } from '@/lib/overrideClip';

// Returns the UTC timestamp corresponding to midnight (00:00:00) on dateStr in the given IANA timezone.
// Uses noon UTC as the anchor to avoid DST edge cases at midnight.
function localMidnightUTC(dateStr: string, timezone: string): Date {
  const noonUTC = new Date(`${dateStr}T12:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(noonUTC)
  const localHour = Number(parts.find(p => p.type === 'hour')!.value)
  const localMin = Number(parts.find(p => p.type === 'minute')!.value)
  const tzOffsetMin = localHour * 60 + localMin - 12 * 60
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - tzOffsetMin * 60_000)
}

export function slotsForWindows(
  windows: Array<{ start_time: string; end_time: string }>,
  blockOverrides: Array<{ start_time: string; end_time: string }>,
  bookedRows: Array<{ start_at: Date; end_at: Date }>,
  date: string,
  durationMinutes: number,
  timezone: string,
): Array<{ startAt: string; endAt: string; available: boolean }> {
  const slots: Array<{ startAt: string; endAt: string; available: boolean }> = [];
  const midnight = localMidnightUTC(date, timezone);
  
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
        const slotStart = new Date(midnight.getTime() + cursor * 60_000);
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
  timezone: string,
): Promise<Array<{ startAt: string; endAt: string; available: boolean }>> {
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();

  const { rows: schedules } = await client.query<{ start_time: string; end_time: string }>(
    'SELECT start_time, end_time FROM staff_schedules WHERE staff_id = $1 AND day_of_week = $2 ORDER BY start_time',
    [staffId, dayOfWeek],
  );

  type OverrideRow = { start_time: string; end_time: string; start_date: string; end_date: string };

  const { rows: addOverrideRows } = await client.query<OverrideRow>(
    `SELECT start_time, end_time, start_date::text AS start_date, end_date::text AS end_date
     FROM staff_schedule_overrides
     WHERE staff_id = $1 AND type = 'available' AND start_date <= $2::date AND end_date >= $2::date`,
    [staffId, date],
  );
  const addOverrides = addOverrideRows.map(r => {
    const c = clipOverrideWindow({ startDate: r.start_date, endDate: r.end_date, startTime: r.start_time, endTime: r.end_time }, date);
    return { start_time: c.startTime, end_time: c.endTime };
  });

  if (schedules.length === 0 && addOverrides.length === 0) return [];

  const { rows: blockOverrideRows } = await client.query<OverrideRow>(
    `SELECT start_time, end_time, start_date::text AS start_date, end_date::text AS end_date
     FROM staff_schedule_overrides
     WHERE staff_id = $1 AND type = 'not_available' AND start_date <= $2::date AND end_date >= $2::date`,
    [staffId, date],
  );
  const blockOverrides = blockOverrideRows.map(r => {
    const c = clipOverrideWindow({ startDate: r.start_date, endDate: r.end_date, startTime: r.start_time, endTime: r.end_time }, date);
    return { start_time: c.startTime, end_time: c.endTime };
  });

  const { rows: bookedRows } = await client.query<{ start_at: Date; end_at: Date }>(
    `SELECT start_at, end_at FROM bookings
     WHERE staff_id = $1 AND status != 'cancelled'
       AND start_at >= $2::date::timestamp AT TIME ZONE $3
       AND start_at < ($2::date + interval '1 day')::timestamp AT TIME ZONE $3`,
    [staffId, date, timezone],
  );
  
  return slotsForWindows([...schedules, ...addOverrides], blockOverrides, bookedRows, date, durationMinutes, timezone);
}

export async function generateAvailableDatesInWindow(
  client: PoolClient,
  params: {
    tenantId: string;
    serviceId: string;
    locationId: string;
    staffId: string | null;
    startDate: string;
    endDate: string;
    durationMinutes: number;
    timezone: string;
  },
): Promise<string[]> {
  const { tenantId, serviceId, locationId, staffId, startDate, endDate, durationMinutes, timezone } = params;

  // Build ordered list of dates in the window
  const dates: string[] = [];
  for (let d = new Date(`${startDate}T00:00:00Z`); d <= new Date(`${endDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  // Resolve staff IDs — 0 queries if staffId is provided, 1 query if any-available
  let staffIds: string[];
  if (staffId !== null) {
    staffIds = [staffId];
  } else {
    const { rows } = await client.query<{ id: string }>(
      `SELECT s.id FROM staff s
       JOIN staff_services ss ON ss.staff_id = s.id AND ss.service_id = $1
       WHERE s.tenant_id = $2 AND s.location_id = $3 AND s.is_active = true
       ORDER BY s.created_at`,
      [serviceId, tenantId, locationId],
    );
    if (rows.length === 0) return [];
    staffIds = rows.map(r => r.id);
  }

  const daysOfWeek = [...new Set(dates.map(d => new Date(`${d}T00:00:00Z`).getUTCDay()))];

  // Batch fetch all schedules for the relevant staff and days of week
  const { rows: scheduleRows } = await client.query<{
    staff_id: string; day_of_week: number; start_time: string; end_time: string;
  }>(
    `SELECT staff_id, day_of_week, start_time, end_time
     FROM staff_schedules
     WHERE staff_id = ANY($1) AND day_of_week = ANY($2)
     ORDER BY start_time`,
    [staffIds, daysOfWeek],
  );

  // Batch fetch all overrides overlapping the window
  type OverrideRow = {
    staff_id: string; type: string;
    start_time: string; end_time: string;
    start_date: string; end_date: string;
  };
  const { rows: overrideRows } = await client.query<OverrideRow>(
    `SELECT staff_id, type, start_time, end_time,
            start_date::text AS start_date, end_date::text AS end_date
     FROM staff_schedule_overrides
     WHERE staff_id = ANY($1) AND start_date <= $2::date AND end_date >= $3::date`,
    [staffIds, endDate, startDate],
  );

  // Batch fetch all bookings in the UTC-equivalent window span
  const windowStartUTC = localMidnightUTC(startDate, timezone);
  const windowEndUTC = new Date(localMidnightUTC(endDate, timezone).getTime() + 24 * 60 * 60_000);
  const { rows: bookingRows } = await client.query<{
    staff_id: string; start_at: Date; end_at: Date;
  }>(
    `SELECT staff_id, start_at, end_at FROM bookings
     WHERE staff_id = ANY($1) AND status != 'cancelled'
       AND start_at < $2 AND end_at > $3`,
    [staffIds, windowEndUTC, windowStartUTC],
  );

  // Group pre-fetched data by staff_id for O(1) lookup per date
  const schedulesByStaff = new Map<string, Array<{ day_of_week: number; start_time: string; end_time: string }>>();
  for (const row of scheduleRows) {
    const arr = schedulesByStaff.get(row.staff_id) ?? [];
    arr.push(row);
    schedulesByStaff.set(row.staff_id, arr);
  }

  const overridesByStaff = new Map<string, OverrideRow[]>();
  for (const row of overrideRows) {
    const arr = overridesByStaff.get(row.staff_id) ?? [];
    arr.push(row);
    overridesByStaff.set(row.staff_id, arr);
  }

  const bookingsByStaff = new Map<string, Array<{ start_at: Date; end_at: Date }>>();
  for (const row of bookingRows) {
    const arr = bookingsByStaff.get(row.staff_id) ?? [];
    arr.push({ start_at: row.start_at, end_at: row.end_at });
    bookingsByStaff.set(row.staff_id, arr);
  }

  // Compute availability per date entirely in memory
  const availableDates: string[] = [];

  for (const date of dates) {
    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
    const dayMidnight = localMidnightUTC(date, timezone);
    const dayEnd = new Date(dayMidnight.getTime() + 24 * 60 * 60_000);

    let dateHasSlot = false;

    for (const sid of staffIds) {
      if (dateHasSlot) break;

      const schedules = (schedulesByStaff.get(sid) ?? []).filter(s => s.day_of_week === dayOfWeek);
      const staffOverrides = overridesByStaff.get(sid) ?? [];

      const addOverrides = staffOverrides
        .filter(o => o.type === 'available' && o.start_date <= date && o.end_date >= date)
        .map(o => {
          const c = clipOverrideWindow({ startDate: o.start_date, endDate: o.end_date, startTime: o.start_time, endTime: o.end_time }, date);
          return { start_time: c.startTime, end_time: c.endTime };
        });

      const windows = [...schedules, ...addOverrides];
      if (windows.length === 0) continue;

      const blockOverrides = staffOverrides
        .filter(o => o.type === 'not_available' && o.start_date <= date && o.end_date >= date)
        .map(o => {
          const c = clipOverrideWindow({ startDate: o.start_date, endDate: o.end_date, startTime: o.start_time, endTime: o.end_time }, date);
          return { start_time: c.startTime, end_time: c.endTime };
        });

      const staffBookings = (bookingsByStaff.get(sid) ?? []).filter(
        b => new Date(b.start_at) < dayEnd && new Date(b.end_at) > dayMidnight,
      );

      const slots = slotsForWindows(windows, blockOverrides, staffBookings, date, durationMinutes, timezone);
      if (slots.some(s => s.available)) dateHasSlot = true;
    }

    if (dateHasSlot) availableDates.push(date);
  }

  return availableDates;
}

export async function generateAnyAvailableSlots(
  client: PoolClient,
  tenantId: string,
  serviceId: string,
  locationId: string,
  date: string,
  durationMinutes: number,
  timezone: string,
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
    const staffSlots = await generateStaffSlots(client, staffId, date, durationMinutes, timezone);
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
