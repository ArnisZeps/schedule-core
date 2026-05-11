import { db } from '@/lib/server/db';
import { withTenantContext } from '@/lib/server/withTenantContext';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serviceId: string }> },
) {
  const { tenantSlug, serviceId } = await params;

  const locationId = new URL(request.url).searchParams.get('locationId');
  if (!locationId) {
    return Response.json(
      { error: 'validation_error', details: ['locationId is required'] },
      { status: 422 },
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
    const { rows: svcRows } = await client.query(
      'SELECT 1 FROM services WHERE id = $1 AND tenant_id = $2',
      [serviceId, tenantId],
    );
    if (svcRows.length === 0) return null;

    const { rows } = await client.query<{ id: string; name: string }>(
      `SELECT s.id, s.name
       FROM staff s
       JOIN staff_services ss ON ss.staff_id = s.id AND ss.service_id = $1
       WHERE s.tenant_id = $2 AND s.location_id = $3 AND s.is_active = true
       ORDER BY s.created_at`,
      [serviceId, tenantId, locationId],
    );
    return rows;
  });

  if (result === null) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(result);
}
