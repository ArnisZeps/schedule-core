import { db } from '@/lib/server/db';
import { generateAnyAvailableSlots } from '@/lib/server/availability';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serviceId: string }> },
) {
  const { tenantSlug, serviceId } = await params;
  const sp = new URL(request.url).searchParams;
  const date = sp.get('date');
  const duration = sp.get('duration');

  if (!date || !DATE_RE.test(date) || isNaN(Date.parse(date))) {
    return Response.json({ error: 'invalid_param', param: 'date' }, { status: 400 });
  }
  if (!duration || isNaN(Number(duration)) || Number(duration) <= 0) {
    return Response.json({ error: 'invalid_param', param: 'duration' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    const { rows: tenantRows } = await client.query<{ id: string }>(
      'SELECT id FROM tenants WHERE slug = $1',
      [tenantSlug],
    );
    if (tenantRows.length === 0) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    const tenantId = tenantRows[0].id;

    const { rows: locationRows } = await client.query<{ id: string }>(
      'SELECT id FROM locations WHERE tenant_id = $1 AND is_active = true',
      [tenantId],
    );
    if (locationRows.length !== 1) {
      return Response.json(
        { error: 'This business has multiple locations. Use the booking widget to select a location.' },
        { status: 422 },
      );
    }
    const locationId = locationRows[0].id;

    const slots = await generateAnyAvailableSlots(client, tenantId, serviceId, locationId, date, Number(duration));
    return Response.json(slots);
  } finally {
    client.release();
  }
}
