import { db } from '@/lib/server/db';
import { generateSlots } from '@/lib/server/availability';

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

    const slots = await generateSlots(client, serviceId, date, Number(duration));
    return Response.json(slots);
  } finally {
    client.release();
  }
}
