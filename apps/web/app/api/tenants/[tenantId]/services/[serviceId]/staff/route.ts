import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { withTenantContext } from '@/lib/server/withTenantContext';

type StaffRow = {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  location_id: string;
  created_at: Date;
};

function format(r: StaffRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    isActive: r.is_active,
    locationId: r.location_id,
    createdAt: r.created_at,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; serviceId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, serviceId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const locationId = new URL(request.url).searchParams.get('locationId');
  if (!locationId) {
    return Response.json({ error: 'invalid_param', param: 'locationId' }, { status: 400 });
  }

  const rows = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<StaffRow>(
      `SELECT s.id, s.tenant_id, s.name, s.email, s.phone, s.is_active, s.location_id, s.created_at
       FROM staff s
       JOIN staff_services ss ON ss.staff_id = s.id AND ss.service_id = $1
       WHERE s.tenant_id = $2 AND s.location_id = $3 AND s.is_active = true
       ORDER BY s.created_at`,
      [serviceId, tenantId, locationId],
    );
    return rows;
  });

  return Response.json(rows.map(format));
}
