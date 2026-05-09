import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { withTenantContext } from '@/lib/server/withTenantContext';
import { checkOverlap, checkWithinAvailability } from '@/lib/server/availability';

type BookingRow = {
  id: string;
  tenant_id: string;
  service_id: string;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  start_at: Date;
  end_at: Date;
  status: string;
  notes: string | null;
  created_at: Date;
};

function format(r: BookingRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    serviceId: r.service_id,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    clientEmail: r.client_email,
    startAt: r.start_at,
    endAt: r.end_at,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

const ISO8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const SELECT_COLS =
  'id, tenant_id, service_id, client_name, client_phone, client_email, start_at, end_at, status, notes, created_at';

const createSchema = z
  .object({
    serviceId: z.string().uuid(),
    clientName: z.string().min(1),
    clientPhone: z.string().min(7),
    clientEmail: z.string().email().optional(),
    startAt: z.string().regex(ISO8601),
    endAt: z.string().regex(ISO8601),
    notes: z.string().optional(),
    override: z.boolean().optional(),
  })
  .refine((d) => new Date(d.startAt) < new Date(d.endAt), {
    message: 'startAt must be before endAt',
  });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const from = sp.get('from') ?? undefined;
  const to = sp.get('to') ?? undefined;
  const serviceId = sp.get('serviceId') ?? undefined;
  const status = sp.get('status') ?? undefined;

  if (from && isNaN(Date.parse(from))) {
    return Response.json({ error: 'invalid_param', param: 'from' }, { status: 400 });
  }
  if (to && isNaN(Date.parse(to))) {
    return Response.json({ error: 'invalid_param', param: 'to' }, { status: 400 });
  }

  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (from)      { conditions.push(`start_at >= $${i++}`);  values.push(from); }
  if (to)        { conditions.push(`start_at <= $${i++}`);  values.push(to); }
  if (serviceId) { conditions.push(`service_id = $${i++}`); values.push(serviceId); }
  if (status === 'active') { conditions.push(`status != 'cancelled'`); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<BookingRow>(
      `SELECT ${SELECT_COLS} FROM bookings ${where} ORDER BY start_at`,
      values,
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

  const { serviceId, clientName, clientPhone, clientEmail, startAt, endAt, notes, override } = parsed.data;
  const start = new Date(startAt);
  const end = new Date(endAt);

  const result = await withTenantContext(db, tenantId, async (client) => {
    const { rows: serviceRows } = await client.query('SELECT 1 FROM services WHERE id = $1', [serviceId]);
    if (serviceRows.length === 0) return 'not_found' as const;

    if (!override) {
      if (!(await checkWithinAvailability(client, serviceId, start, end))) {
        return 'outside_availability' as const;
      }
      if (await checkOverlap(client, serviceId, start, end)) {
        return 'overlap' as const;
      }
    }

    const { rows } = await client.query<BookingRow>(
      `INSERT INTO bookings (tenant_id, service_id, client_name, client_phone, client_email, start_at, end_at, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8) RETURNING ${SELECT_COLS}`,
      [tenantId, serviceId, clientName, clientPhone, clientEmail ?? null, start, end, notes ?? null],
    );
    return rows[0];
  });

  if (result === 'not_found')            return Response.json({ error: 'not_found' }, { status: 404 });
  if (result === 'outside_availability') return Response.json({ error: 'outside_availability' }, { status: 409 });
  if (result === 'overlap')              return Response.json({ error: 'overlap' }, { status: 409 });
  return Response.json(format(result), { status: 201 });
}
