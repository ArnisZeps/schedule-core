import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { withTenantContext } from '@/lib/server/withTenantContext';

type OverrideRow = {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  type: string;
  start_time: string;
  end_time: string;
  created_at: Date;
};

const OVERRIDE_SELECT =
  'id, staff_id, start_date::text AS start_date, end_date::text AS end_date, type, start_time, end_time, created_at';

function formatOverride(r: OverrideRow) {
  return {
    id: r.id,
    staffId: r.staff_id,
    startDate: r.start_date,
    endDate: r.end_date,
    type: r.type,
    startTime: r.start_time.substring(0, 5),
    endTime: r.end_time.substring(0, 5),
    createdAt: r.created_at,
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const overrideBodySchema = z
  .object({
    startDate: z.string().regex(DATE_RE),
    endDate: z.string().regex(DATE_RE),
    type: z.enum(['available', 'not_available']),
    startTime: z.string().regex(TIME),
    endTime: z.string().regex(TIME),
  })
  .refine((d) => d.startTime < d.endTime, { message: 'startTime must be before endTime' })
  .refine((d) => d.startDate <= d.endDate, { message: 'startDate must be on or before endDate' });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; staffId: string; overrideId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, staffId, overrideId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = overrideBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) },
      { status: 422 },
    );
  }

  const { startDate, endDate, type, startTime, endTime } = parsed.data;
  const row = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<OverrideRow>(
      `UPDATE staff_schedule_overrides
       SET start_date = $1, end_date = $2, type = $3, start_time = $4, end_time = $5
       WHERE id = $6 AND staff_id = $7
       RETURNING ${OVERRIDE_SELECT}`,
      [startDate, endDate, type, startTime, endTime, overrideId, staffId],
    );
    return rows[0] ?? null;
  });

  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(formatOverride(row));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; staffId: string; overrideId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, staffId, overrideId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  let rowCount = 0;
  await withTenantContext(db, tenantId, async (client) => {
    const result = await client.query(
      'DELETE FROM staff_schedule_overrides WHERE id = $1 AND staff_id = $2',
      [overrideId, staffId],
    );
    rowCount = result.rowCount ?? 0;
  });

  if (rowCount === 0) return Response.json({ error: 'not_found' }, { status: 404 });
  return new Response(null, { status: 204 });
}
