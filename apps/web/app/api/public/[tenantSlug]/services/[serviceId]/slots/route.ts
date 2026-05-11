import { db } from '@/lib/server/db';
import { withTenantContext } from '@/lib/server/withTenantContext';
import { generateStaffSlots, generateAnyAvailableSlots } from '@/lib/server/availability';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serviceId: string }> },
) {
  const { tenantSlug, serviceId } = await params;
  const sp = new URL(request.url).searchParams;
  const date = sp.get('date');
  const locationId = sp.get('locationId');
  const staffId = sp.get('staffId');
  const durationOverride = sp.get('duration');

  if (!date || !DATE_RE.test(date) || isNaN(Date.parse(date))) {
    return Response.json({ error: 'invalid_param', param: 'date' }, { status: 400 });
  }
  if (!staffId && !locationId) {
    return Response.json(
      { error: 'invalid_param', param: 'locationId', message: 'locationId is required when staffId is not provided' },
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

  const result = await withTenantContext(db, tenantId, async (client) => {
    const { rows: svcRows } = await client.query<{ duration_minutes: number }>(
      'SELECT duration_minutes FROM services WHERE id = $1 AND tenant_id = $2',
      [serviceId, tenantId],
    );
    if (svcRows.length === 0) return null;

    const durationMinutes =
      durationOverride && !isNaN(Number(durationOverride)) && Number(durationOverride) > 0
        ? Number(durationOverride)
        : svcRows[0].duration_minutes;

    if (staffId) {
      const { rows: tzRows } = await client.query<{ timezone: string }>(
        'SELECT l.timezone FROM staff s JOIN locations l ON l.id = s.location_id WHERE s.id = $1',
        [staffId],
      );
      const timezone = tzRows[0]?.timezone ?? 'UTC';
      return generateStaffSlots(client, staffId, date, durationMinutes, timezone);
    }
    const { rows: tzRows } = await client.query<{ timezone: string }>(
      'SELECT timezone FROM locations WHERE id = $1',
      [locationId],
    );
    const timezone = tzRows[0]?.timezone ?? 'UTC';
    return generateAnyAvailableSlots(client, tenantId, serviceId, locationId!, date, durationMinutes, timezone);
  });

  if (result === null) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(result);
}
