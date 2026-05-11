import { db } from '@/lib/server/db';
import { withTenantContext } from '@/lib/server/withTenantContext';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;

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

  const locations = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<{
      id: string; name: string; address: string | null; timezone: string;
    }>(
      `SELECT id, name, address, timezone
       FROM locations
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY created_at`,
      [tenantId],
    );
    return rows;
  });

  return Response.json(locations);
}
