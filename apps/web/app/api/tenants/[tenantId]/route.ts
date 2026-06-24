import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { withTenantContext } from '@/lib/server/withTenantContext';
import { verifyPassword } from '@/lib/server/password';

type TenantRow = { id: string; name: string; slug: string; created_at: Date };

function format(t: TenantRow) {
  return { id: t.id, name: t.name, slug: t.slug, createdAt: t.created_at };
}

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: z.string().regex(/^[a-z0-9-]{3,50}$/).optional(),
  })
  .refine((d) => d.name !== undefined || d.slug !== undefined, {
    message: 'at_least_one_field_required',
  });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const client = await db.connect();
  try {
    const { rows } = await client.query<TenantRow>(
      'SELECT id, name, slug, created_at FROM tenants WHERE id = $1',
      [tenantId],
    );
    if (rows.length === 0) return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json(format(rows[0]));
  } finally {
    client.release();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
    return Response.json({ error: 'validation_error', details }, { status: 422 });
  }

  const { name, slug } = parsed.data;
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (name !== undefined) { sets.push(`name = $${i++}`); values.push(name); }
  if (slug !== undefined) { sets.push(`slug = $${i++}`); values.push(slug); }
  values.push(tenantId);

  const client = await db.connect();
  try {
    let rows: TenantRow[];
    try {
      const result = await client.query<TenantRow>(
        `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, name, slug, created_at`,
        values,
      );
      rows = result.rows;
    } catch (err: any) {
      if (err.constraint === 'tenants_slug_key') {
        return Response.json({ error: 'slug_taken' }, { status: 409 });
      }
      throw err;
    }
    if (rows.length === 0) return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json(format(rows[0]));
  } finally {
    client.release();
  }
}

const deleteSchema = z.object({
  password: z.string().min(1),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'validation_error' }, { status: 422 });
  }

  // Deliberate, password-gated account deletion: explicitly purge bookings
  // (ON DELETE RESTRICT) before deleting the tenant, which cascades the rest.
  // Tenant context is required so RLS permits the bookings delete (ADR-013).
  const outcome = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [auth.userId],
    );
    if (rows.length === 0 || !(await verifyPassword(parsed.data.password, rows[0].password_hash))) {
      return 'invalid_password' as const;
    }
    await client.query('DELETE FROM bookings WHERE tenant_id = $1', [tenantId]);
    const result = await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    return (result.rowCount ?? 0) === 0 ? ('not_found' as const) : ('deleted' as const);
  });

  if (outcome === 'invalid_password') {
    return Response.json({ error: 'invalid_password' }, { status: 403 });
  }
  if (outcome === 'not_found') {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': 'sc_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' },
  });
}
