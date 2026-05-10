import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { withTenantContext } from '@/lib/server/withTenantContext';

type LocationRow = {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  timezone: string;
  is_active: boolean;
  created_at: Date;
};

const LOCATION_COLS = 'id, tenant_id, name, address, timezone, is_active, created_at';

function formatLocation(r: LocationRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    address: r.address,
    timezone: r.timezone,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

const patchLocationSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().nullish(),
  timezone: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; locationId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, locationId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const row = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<LocationRow>(
      `SELECT ${LOCATION_COLS} FROM locations WHERE id = $1`,
      [locationId],
    );
    return rows[0] ?? null;
  });

  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(formatLocation(row));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; locationId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, locationId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = patchLocationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) },
      { status: 422 },
    );
  }

  const { name, address, timezone, isActive } = parsed.data;
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (name !== undefined)     { sets.push(`name = $${i++}`);      values.push(name); }
  if (address !== undefined)  { sets.push(`address = $${i++}`);   values.push(address ?? null); }
  if (timezone !== undefined) { sets.push(`timezone = $${i++}`);  values.push(timezone); }
  if (isActive !== undefined) { sets.push(`is_active = $${i++}`); values.push(isActive); }
  values.push(locationId);

  const row = await withTenantContext(db, tenantId, async (client) => {
    if (sets.length === 0) {
      const { rows } = await client.query<LocationRow>(
        `SELECT ${LOCATION_COLS} FROM locations WHERE id = $1`,
        [locationId],
      );
      return rows[0] ?? null;
    }
    const { rows } = await client.query<LocationRow>(
      `UPDATE locations SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${LOCATION_COLS}`,
      values,
    );
    return rows[0] ?? null;
  });

  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(formatLocation(row));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; locationId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, locationId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  try {
    await withTenantContext(db, tenantId, async (client) => {
      await client.query('DELETE FROM locations WHERE id = $1', [locationId]);
    });
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23503') {
      return Response.json(
        { error: 'Reassign all staff and ensure no bookings reference this location before deleting.' },
        { status: 409 },
      );
    }
    throw err;
  }
}
