import { z } from 'zod';
import type { PoolClient } from '@schedule-core/db';
import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { withTenantContext } from '@/lib/server/withTenantContext';

type RuleRow = {
  id: string;
  tenant_id: string;
  service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: Date;
};

function format(r: RuleRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    serviceId: r.service_id,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time.substring(0, 5),
    endTime: r.end_time.substring(0, 5),
    createdAt: r.created_at,
  };
}

const TIME = /^\d{2}:\d{2}$/;
const SELECT_COLS = 'id, tenant_id, service_id, day_of_week, start_time, end_time, created_at';

const createSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(TIME),
    endTime: z.string().regex(TIME),
  })
  .refine((d) => d.startTime < d.endTime, { message: 'startTime must be before endTime' });

async function serviceExists(client: PoolClient, serviceId: string): Promise<boolean> {
  const { rows } = await client.query('SELECT 1 FROM services WHERE id = $1', [serviceId]);
  return rows.length > 0;
}

async function hasOverlap(
  client: PoolClient,
  serviceId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeId?: string,
): Promise<boolean> {
  const values: unknown[] = [serviceId, dayOfWeek, startTime, endTime];
  let sql =
    'SELECT 1 FROM availability_rules WHERE service_id = $1 AND day_of_week = $2 AND end_time > $3 AND start_time < $4';
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id != $${values.length}`;
  }
  const { rows } = await client.query(sql, values);
  return rows.length > 0;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; serviceId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, serviceId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const result = await withTenantContext(db, tenantId, async (client) => {
    if (!(await serviceExists(client, serviceId))) return null;
    const { rows } = await client.query<RuleRow>(
      `SELECT ${SELECT_COLS} FROM availability_rules WHERE service_id = $1 ORDER BY day_of_week, start_time`,
      [serviceId],
    );
    return rows;
  });

  if (result === null) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(result.map(format));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; serviceId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, serviceId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
    return Response.json({ error: 'validation_error', details }, { status: 422 });
  }

  const { dayOfWeek, startTime, endTime } = parsed.data;

  const result = await withTenantContext(db, tenantId, async (client) => {
    if (!(await serviceExists(client, serviceId))) return 'not_found' as const;
    if (await hasOverlap(client, serviceId, dayOfWeek, startTime, endTime)) return 'overlap' as const;
    const { rows } = await client.query<RuleRow>(
      `INSERT INTO availability_rules (tenant_id, service_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${SELECT_COLS}`,
      [tenantId, serviceId, dayOfWeek, startTime, endTime],
    );
    return rows[0];
  });

  if (result === 'not_found') return Response.json({ error: 'not_found' }, { status: 404 });
  if (result === 'overlap') return Response.json({ error: 'overlap' }, { status: 409 });
  return Response.json(format(result), { status: 201 });
}
