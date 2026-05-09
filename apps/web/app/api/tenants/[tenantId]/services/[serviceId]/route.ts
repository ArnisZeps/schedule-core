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

function format(r: ServiceRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    description: r.description,
    durationMinutes: r.duration_minutes,
    createdAt: r.created_at,
  };
}

const SELECT_COLS = 'id, tenant_id, name, description, duration_minutes, created_at';

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    durationMinutes: z.number().int().positive().optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.description !== undefined || d.durationMinutes !== undefined,
    { message: 'at_least_one_field_required' },
  );

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; serviceId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, serviceId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const row = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<ServiceRow>(
      `SELECT ${SELECT_COLS} FROM services WHERE id = $1 AND tenant_id = $2`,
      [serviceId, tenantId],
    );
    return rows[0] ?? null;
  });

  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(format(row));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; serviceId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, serviceId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
    return Response.json({ error: 'validation_error', details }, { status: 422 });
  }

  const { name, description, durationMinutes } = parsed.data;
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (name !== undefined)            { sets.push(`name = $${i++}`);             values.push(name); }
  if (description !== undefined)     { sets.push(`description = $${i++}`);      values.push(description); }
  if (durationMinutes !== undefined) { sets.push(`duration_minutes = $${i++}`); values.push(durationMinutes); }
  values.push(serviceId);

  const row = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<ServiceRow>(
      `UPDATE services SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${SELECT_COLS}`,
      values,
    );
    return rows[0] ?? null;
  });

  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(format(row));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; serviceId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, serviceId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  try {
    let rowCount = 0;
    await withTenantContext(db, tenantId, async (client) => {
      const result = await client.query('DELETE FROM services WHERE id = $1', [serviceId]);
      rowCount = result.rowCount ?? 0;
    });
    if (rowCount === 0) return Response.json({ error: 'not_found' }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err: any) {
    if (err.code === '23503') {
      return Response.json({ error: 'has_bookings' }, { status: 409 });
    }
    throw err;
  }
}
