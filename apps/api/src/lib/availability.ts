import type { PoolClient } from '@schedule-core/db';

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

export async function checkWithinAvailability(
  client: PoolClient,
  serviceId: string,
  start: Date,
  end: Date,
): Promise<boolean> {
  const dayOfWeek = start.getUTCDay();
  const startTime = `${String(start.getUTCHours()).padStart(2, '0')}:${String(start.getUTCMinutes()).padStart(2, '0')}`;
  const endTime = `${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`;

  const { rows } = await client.query(
    `SELECT 1 FROM availability_rules
     WHERE service_id = $1
       AND day_of_week = $2
       AND start_time <= $3::time
       AND end_time   >= $4::time`,
    [serviceId, dayOfWeek, startTime, endTime],
  );
  return rows.length > 0;
}

export async function generateSlots(
  client: PoolClient,
  serviceId: string,
  date: string,
  durationMinutes: number,
): Promise<Array<{ startAt: string; endAt: string }>> {
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();

  const { rows: rules } = await client.query<{ start_time: string; end_time: string }>(
    'SELECT start_time, end_time FROM availability_rules WHERE service_id = $1 AND day_of_week = $2 ORDER BY start_time',
    [serviceId, dayOfWeek],
  );

  if (rules.length === 0) return [];

  const { rows: bookedRows } = await client.query<{ start_at: Date; end_at: Date }>(
    `SELECT start_at, end_at FROM bookings
     WHERE service_id = $1
       AND status != 'cancelled'
       AND start_at >= $2::timestamptz
       AND start_at < ($2::date + INTERVAL '1 day')::timestamptz`,
    [serviceId, date],
  );

  const slots: Array<{ startAt: string; endAt: string }> = [];

  for (const rule of rules) {
    const [ruleStartH, ruleStartM] = rule.start_time.split(':').map(Number);
    const [ruleEndH, ruleEndM] = rule.end_time.split(':').map(Number);
    const windowStartMin = ruleStartH * 60 + ruleStartM;
    const windowEndMin = ruleEndH * 60 + ruleEndM;

    let cursor = windowStartMin;
    while (cursor + durationMinutes <= windowEndMin) {
      const slotStart = new Date(`${date}T00:00:00Z`);
      slotStart.setUTCMinutes(slotStart.getUTCMinutes() + cursor);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);

      const overlaps = bookedRows.some(
        (b) => new Date(b.start_at) < slotEnd && new Date(b.end_at) > slotStart,
      );

      if (!overlaps) {
        slots.push({ startAt: slotStart.toISOString(), endAt: slotEnd.toISOString() });
      }

      cursor += durationMinutes;
    }
  }

  return slots;
}
