import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { withTenantContext } from '@/lib/server/withTenantContext';

type ScheduleRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

function formatSchedule(r: ScheduleRow) {
  return {
    id: r.id,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time.substring(0, 5),
    endTime: r.end_time.substring(0, 5),
  };
}

const TIME = /^\d{2}:\d{2}$/;

const windowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(TIME),
  endTime: z.string().regex(TIME),
});

const putSchedulesSchema = z.object({
  windows: z.array(windowSchema),
});

const SCHEDULE_QUERY =
  'SELECT id, day_of_week, start_time, end_time FROM staff_schedules WHERE staff_id = $1 ORDER BY day_of_week, start_time';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; staffId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, staffId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const rows = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<ScheduleRow>(SCHEDULE_QUERY, [staffId]);
    return rows;
  });

  return Response.json(rows.map(formatSchedule));
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
  const parsed = putSchedulesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) },
      { status: 422 },
    );
  }

  const { windows } = parsed.data;
  const rows = await withTenantContext(db, tenantId, async (client) => {
    await client.query('DELETE FROM staff_schedules WHERE staff_id = $1', [staffId]);
    for (const w of windows) {
      await client.query(
        'INSERT INTO staff_schedules (staff_id, tenant_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4, $5)',
        [staffId, tenantId, w.dayOfWeek, w.startTime, w.endTime],
      );
    }
    const { rows } = await client.query<ScheduleRow>(SCHEDULE_QUERY, [staffId]);
    return rows;
  });

  return Response.json(rows.map(formatSchedule));
}
