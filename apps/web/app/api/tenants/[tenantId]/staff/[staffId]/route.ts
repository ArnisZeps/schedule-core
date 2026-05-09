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

const patchStaffSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; staffId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, staffId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const row = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<StaffRow>(
      `SELECT ${STAFF_COLS} FROM staff WHERE id = $1 AND tenant_id = $2`,
      [staffId, tenantId],
    );
    return rows[0] ?? null;
  });

  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(formatStaff(row));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; staffId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, staffId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = patchStaffSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) },
      { status: 422 },
    );
  }

  const { name, email, phone, isActive } = parsed.data;
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (name !== undefined)     { sets.push(`name = $${i++}`);      values.push(name); }
  if (email !== undefined)    { sets.push(`email = $${i++}`);     values.push(email ?? null); }
  if (phone !== undefined)    { sets.push(`phone = $${i++}`);     values.push(phone ?? null); }
  if (isActive !== undefined) { sets.push(`is_active = $${i++}`); values.push(isActive); }
  values.push(staffId);

  const row = await withTenantContext(db, tenantId, async (client) => {
    if (sets.length === 0) {
      const { rows } = await client.query<StaffRow>(
        `SELECT ${STAFF_COLS} FROM staff WHERE id = $1 AND tenant_id = $2`,
        [staffId, tenantId],
      );
      return rows[0] ?? null;
    }
    const { rows } = await client.query<StaffRow>(
      `UPDATE staff SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${STAFF_COLS}`,
      values,
    );
    return rows[0] ?? null;
  });

  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(formatStaff(row));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; staffId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, staffId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  await withTenantContext(db, tenantId, async (client) => {
    await client.query('DELETE FROM staff WHERE id = $1', [staffId]);
  });
  return new Response(null, { status: 204 });
}
