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

const createLocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  timezone: z.string().min(1),
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
      ? `SELECT ${LOCATION_COLS} FROM locations ORDER BY created_at`
      : `SELECT ${LOCATION_COLS} FROM locations WHERE is_active = true ORDER BY created_at`;
    const { rows } = await client.query<LocationRow>(sql);
    return rows;
  });

  return Response.json(rows.map(formatLocation));
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
  const parsed = createLocationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_error', details: parsed.error.issues.map((i) => i.path.join('.') || i.message) },
      { status: 422 },
    );
  }

  const { name, address, timezone } = parsed.data;

  const validTimezones = Intl.supportedValuesOf('timeZone');
  if (!validTimezones.includes(timezone)) {
    return Response.json(
      { error: 'validation_error', details: ['timezone'] },
      { status: 422 },
    );
  }

  const row = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<LocationRow>(
      `INSERT INTO locations (tenant_id, name, address, timezone) VALUES ($1, $2, $3, $4) RETURNING ${LOCATION_COLS}`,
      [tenantId, name, address ?? null, timezone],
    );
    return rows[0];
  });

  return Response.json(formatLocation(row), { status: 201 });
}
