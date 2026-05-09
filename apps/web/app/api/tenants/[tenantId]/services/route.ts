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

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  durationMinutes: z.number().int().positive().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const rows = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<ServiceRow>(
      `SELECT ${SELECT_COLS} FROM services ORDER BY created_at`,
    );
    return rows;
  });

  return Response.json(rows.map(format));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
    return Response.json({ error: 'validation_error', details }, { status: 422 });
  }

  const { name, description, durationMinutes } = parsed.data;
  const cols = ['tenant_id', 'name', 'description'];
  const vals: unknown[] = [tenantId, name, description ?? null];
  if (durationMinutes !== undefined) {
    cols.push('duration_minutes');
    vals.push(durationMinutes);
  }
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');

  const row = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<ServiceRow>(
      `INSERT INTO services (${cols.join(', ')}) VALUES (${placeholders}) RETURNING ${SELECT_COLS}`,
      vals,
    );
    return rows[0];
  });

  return Response.json(format(row), { status: 201 });
}
