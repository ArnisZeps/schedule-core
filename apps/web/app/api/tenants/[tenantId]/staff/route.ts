import { z } from 'zod';
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
  created_at: Date;
};

const STAFF_COLS = 'id, tenant_id, name, email, phone, is_active, created_at';

function formatStaff(r: StaffRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

const createStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';
  const rows = await withTenantContext(db, tenantId, async (client) => {
    const sql = includeInactive
      ? `SELECT ${STAFF_COLS} FROM staff ORDER BY created_at`
      : `SELECT ${STAFF_COLS} FROM staff WHERE is_active = true ORDER BY created_at`;
    const { rows } = await client.query<StaffRow>(sql);
    return rows;
  });

  return Response.json(rows.map(formatStaff));
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
  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) },
      { status: 422 },
    );
  }

  const { name, email, phone } = parsed.data;
  const row = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<StaffRow>(
      `INSERT INTO staff (tenant_id, name, email, phone) VALUES ($1, $2, $3, $4) RETURNING ${STAFF_COLS}`,
      [tenantId, name, email ?? null, phone ?? null],
    );
    return rows[0];
  });

  return Response.json(formatStaff(row), { status: 201 });
}
