import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { withTenantContext } from '@/lib/server/withTenantContext';
import { generateAllSlots } from '@/lib/server/availability';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; serviceId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, serviceId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const date = new URL(request.url).searchParams.get('date');
  if (!date || !DATE_RE.test(date) || isNaN(Date.parse(date))) {
    return Response.json({ error: 'invalid_param', param: 'date' }, { status: 400 });
  }

  const result = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<{ duration_minutes: number }>(
      `SELECT duration_minutes FROM services WHERE id = $1 AND tenant_id = $2`,
      [serviceId, tenantId],
    );
    if (rows.length === 0) return null;
    return generateAllSlots(client, serviceId, date, rows[0].duration_minutes);
  });

  if (result === null) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(result);
}
