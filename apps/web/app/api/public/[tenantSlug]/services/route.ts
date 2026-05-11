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

  const services = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<{
      id: string; name: string; description: string | null; duration_minutes: number;
    }>(
      `SELECT id, name, description, duration_minutes
       FROM services
       WHERE tenant_id = $1
       ORDER BY created_at`,
      [tenantId],
    );
    return rows;
  });

  return Response.json(services.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    durationMinutes: r.duration_minutes,
  })));
}
