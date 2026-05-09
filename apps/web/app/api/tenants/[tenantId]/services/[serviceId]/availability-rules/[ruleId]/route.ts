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

const patchSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    startTime: z.string().regex(TIME).optional(),
    endTime: z.string().regex(TIME).optional(),
  })
  .refine((d) => d.dayOfWeek !== undefined || d.startTime !== undefined || d.endTime !== undefined, {
    message: 'at_least_one_field_required',
  });

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
  { params }: { params: Promise<{ tenantId: string; serviceId: string; ruleId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, serviceId, ruleId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const row = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<RuleRow>(
      `SELECT ${SELECT_COLS} FROM availability_rules WHERE id = $1 AND service_id = $2`,
      [ruleId, serviceId],
    );
    return rows[0] ?? null;
  });

  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(format(row));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; serviceId: string; ruleId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, serviceId, ruleId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
    return Response.json({ error: 'validation_error', details }, { status: 422 });
  }

  const patch = parsed.data;

  const result = await withTenantContext(db, tenantId, async (client) => {
    const { rows: existing } = await client.query<RuleRow>(
      `SELECT ${SELECT_COLS} FROM availability_rules WHERE id = $1 AND service_id = $2`,
      [ruleId, serviceId],
    );
    if (existing.length === 0) return 'not_found' as const;

    const cur = existing[0];
    const merged = {
      dayOfWeek: patch.dayOfWeek ?? cur.day_of_week,
      startTime: patch.startTime ?? cur.start_time.substring(0, 5),
      endTime: patch.endTime ?? cur.end_time.substring(0, 5),
    };

    if (merged.startTime >= merged.endTime) return 'invalid_times' as const;

    if (await hasOverlap(client, serviceId, merged.dayOfWeek, merged.startTime, merged.endTime, ruleId)) {
      return 'overlap' as const;
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (patch.dayOfWeek !== undefined) { sets.push(`day_of_week = $${i++}`); values.push(patch.dayOfWeek); }
    if (patch.startTime !== undefined) { sets.push(`start_time = $${i++}`); values.push(patch.startTime); }
    if (patch.endTime !== undefined)   { sets.push(`end_time = $${i++}`);   values.push(patch.endTime); }
    values.push(ruleId);

    const { rows } = await client.query<RuleRow>(
      `UPDATE availability_rules SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${SELECT_COLS}`,
      values,
    );
    return rows[0];
  });

  if (result === 'not_found') return Response.json({ error: 'not_found' }, { status: 404 });
  if (result === 'invalid_times') {
    return Response.json({ error: 'validation_error', details: ['startTime must be before endTime'] }, { status: 422 });
  }
  if (result === 'overlap') return Response.json({ error: 'overlap' }, { status: 409 });
  return Response.json(format(result));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; serviceId: string; ruleId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, serviceId, ruleId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  let rowCount = 0;
  await withTenantContext(db, tenantId, async (client) => {
    const result = await client.query(
      'DELETE FROM availability_rules WHERE id = $1 AND service_id = $2',
      [ruleId, serviceId],
    );
    rowCount = result.rowCount ?? 0;
  });

  if (rowCount === 0) return Response.json({ error: 'not_found' }, { status: 404 });
  return new Response(null, { status: 204 });
}
