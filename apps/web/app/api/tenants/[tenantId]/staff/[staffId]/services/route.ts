import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { withTenantContext } from '@/lib/server/withTenantContext';

type ServiceRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  created_at: Date;
};

function formatService(r: ServiceRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    description: r.description,
    durationMinutes: r.duration_minutes,
    createdAt: r.created_at,
  };
}

const putServicesSchema = z.object({
  serviceIds: z.array(z.string().uuid()),
});

const SERVICE_QUERY = `
  SELECT s.id, s.tenant_id, s.name, s.description, s.duration_minutes, s.created_at
  FROM services s
  JOIN staff_services ss ON ss.service_id = s.id
  WHERE ss.staff_id = $1
  ORDER BY s.created_at
`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; staffId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, staffId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const rows = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<ServiceRow>(SERVICE_QUERY, [staffId]);
    return rows;
  });

  return Response.json(rows.map(formatService));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; staffId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, staffId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = putServicesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) },
      { status: 422 },
    );
  }

  const { serviceIds } = parsed.data;
  const rows = await withTenantContext(db, tenantId, async (client) => {
    await client.query('DELETE FROM staff_services WHERE staff_id = $1', [staffId]);
    for (const serviceId of serviceIds) {
      await client.query(
        'INSERT INTO staff_services (staff_id, service_id, tenant_id) VALUES ($1, $2, $3)',
        [staffId, serviceId, tenantId],
      );
    }
    const { rows } = await client.query<ServiceRow>(SERVICE_QUERY, [staffId]);
    return rows;
  });

  return Response.json(rows.map(formatService));
}
