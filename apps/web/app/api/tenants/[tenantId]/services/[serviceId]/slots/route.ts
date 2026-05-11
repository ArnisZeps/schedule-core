import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { withTenantContext } from '@/lib/server/withTenantContext';
import { generateStaffSlots, generateAnyAvailableSlots } from '@/lib/server/availability';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; serviceId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, serviceId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const date = sp.get('date');
  const staffId = sp.get('staffId');
  const locationId = sp.get('locationId');

  if (!date || !DATE_RE.test(date) || isNaN(Date.parse(date))) {
    return Response.json({ error: 'invalid_param', param: 'date' }, { status: 400 });
  }
  if (!staffId && !locationId) {
    return Response.json({ error: 'invalid_param', param: 'locationId', message: 'locationId is required when staffId is not provided' }, { status: 400 });
  }
  if (staffId && !UUID_RE.test(staffId)) {
    return Response.json({ error: 'invalid_param', param: 'staffId' }, { status: 400 });
  }
  if (locationId && !UUID_RE.test(locationId)) {
    return Response.json({ error: 'invalid_param', param: 'locationId' }, { status: 400 });
  }

  const result = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<{ duration_minutes: number }>(
      `SELECT duration_minutes FROM services WHERE id = $1 AND tenant_id = $2`,
      [serviceId, tenantId],
    );
    if (rows.length === 0) return null;
    const durationMinutes = rows[0].duration_minutes;

    if (staffId) {
      return generateStaffSlots(client, staffId, date, durationMinutes);
    }
    return generateAnyAvailableSlots(client, tenantId, serviceId, locationId!, date, durationMinutes);
  });

  if (result === null) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(result);
}
