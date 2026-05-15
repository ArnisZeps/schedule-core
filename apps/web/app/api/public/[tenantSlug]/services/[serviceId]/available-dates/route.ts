import { db } from '@/lib/server/db';
import { withTenantContext } from '@/lib/server/withTenantContext';
import { generateStaffSlots, generateAnyAvailableSlots } from '@/lib/server/availability';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WINDOW_DAYS = 14;

function parseDateStr(str: string): Date {
  return new Date(str + 'T00:00:00');
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serviceId: string }> },
) {
  const { tenantSlug, serviceId } = await params;
  const sp = new URL(request.url).searchParams;
  const locationId = sp.get('locationId');
  const staffId = sp.get('staffId');
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');

  if (!locationId) {
    return Response.json({ error: 'invalid_param', param: 'locationId' }, { status: 400 });
  }
  if (!startDate || !DATE_RE.test(startDate)) {
    return Response.json({ error: 'invalid_param', param: 'startDate' }, { status: 400 });
  }
  if (!endDate || !DATE_RE.test(endDate)) {
    return Response.json({ error: 'invalid_param', param: 'endDate' }, { status: 400 });
  }

  const start = parseDateStr(startDate);
  const end = parseDateStr(endDate);
  const windowDays = daysBetween(start, end) + 1;

  if (windowDays > MAX_WINDOW_DAYS || windowDays < 1) {
    return Response.json(
      { error: 'invalid_param', message: `Window must be between 1 and ${MAX_WINDOW_DAYS} days` },
      { status: 400 },
    );
  }

  const tenantClient = await db.connect();
  let tenantId: string;
  try {
    const { rows } = await tenantClient.query<{ id: string }>(
      'SELECT id FROM tenants WHERE slug = $1',
      [tenantSlug],
    );
    if (rows.length === 0) return Response.json({ error: 'not_found' }, { status: 404 });
    tenantId = rows[0].id;
  } finally {
    tenantClient.release();
  }

  const dates: string[] = [];

  await withTenantContext(db, tenantId, async (client) => {
    const { rows: svcRows } = await client.query<{ duration_minutes: number }>(
      'SELECT duration_minutes FROM services WHERE id = $1 AND tenant_id = $2',
      [serviceId, tenantId],
    );
    if (svcRows.length === 0) return;

    const durationMinutes = svcRows[0].duration_minutes;

    const { rows: tzRows } = await client.query<{ timezone: string }>(
      'SELECT timezone FROM locations WHERE id = $1',
      [locationId],
    );
    const timezone = tzRows[0]?.timezone ?? 'UTC';

    for (let i = 0; i < windowDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = toDateStr(d);

      let slots;
      if (staffId) {
        slots = await generateStaffSlots(client, staffId, dateStr, durationMinutes, timezone);
      } else {
        slots = await generateAnyAvailableSlots(client, tenantId, serviceId, locationId, dateStr, durationMinutes, timezone);
      }

      if (slots.some((s) => s.available)) {
        dates.push(dateStr);
      }
    }
  });

  return Response.json(dates);
}
