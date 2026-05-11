import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { withTenantContext } from '@/lib/server/withTenantContext';
import { checkStaffOverlap } from '@/lib/server/availability';

type BookingRow = {
  id: string;
  tenant_id: string;
  service_id: string;
  location_id: string;
  staff_id: string | null;
  staff_name: string | null;
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
    locationId: r.location_id,
    staffId: r.staff_id,
    staffName: r.staff_name,
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
  'b.id, b.tenant_id, b.service_id, b.location_id, b.staff_id, s.name AS staff_name, b.client_name, b.client_phone, b.client_email, b.start_at, b.end_at, b.status, b.notes, b.created_at';
const FROM_JOIN = 'FROM bookings b LEFT JOIN staff s ON s.id = b.staff_id';

const createSchema = z
  .object({
    serviceId: z.string().uuid(),
    locationId: z.string().uuid(),
    clientName: z.string().min(1),
    clientPhone: z.string().min(7),
    clientEmail: z.string().email().optional(),
    startAt: z.string().regex(ISO8601),
    endAt: z.string().regex(ISO8601),
    staffId: z.string().uuid().nullable().optional(),
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

  if (from)      { conditions.push(`b.start_at >= $${i++}`);  values.push(from); }
  if (to)        { conditions.push(`b.start_at <= $${i++}`);  values.push(to); }
  if (serviceId) { conditions.push(`b.service_id = $${i++}`); values.push(serviceId); }
  if (status === 'active') { conditions.push(`b.status != 'cancelled'`); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await withTenantContext(db, tenantId, async (client) => {
    const { rows } = await client.query<BookingRow>(
      `SELECT ${SELECT_COLS} ${FROM_JOIN} ${where} ORDER BY b.start_at`,
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

  const { serviceId, locationId, clientName, clientPhone, clientEmail, startAt, endAt, staffId, notes, override } = parsed.data;
  const start = new Date(startAt);
  const end = new Date(endAt);

  const result = await withTenantContext(db, tenantId, async (client) => {
    const { rows: serviceRows } = await client.query('SELECT 1 FROM services WHERE id = $1', [serviceId]);
    if (serviceRows.length === 0) return 'not_found' as const;

    let resolvedStaffId: string | null = null;

    if (!override) {
      if (staffId != null) {
        // Explicit staff: validate active + assigned to service, check overlap
        const { rows: staffRows } = await client.query(
          `SELECT 1 FROM staff
           WHERE id = $1 AND tenant_id = $2 AND location_id = $3 AND is_active = true`,
          [staffId, tenantId, locationId],
        );
        const { rows: ssRows } = await client.query(
          'SELECT 1 FROM staff_services WHERE staff_id = $1 AND service_id = $2',
          [staffId, serviceId],
        );
        if (staffRows.length === 0 || ssRows.length === 0) return 'invalid_staff' as const;
        if (await checkStaffOverlap(client, staffId, start, end)) return 'overlap' as const;
        resolvedStaffId = staffId;
      } else {
        // Auto-assign: find first free qualified active staff
        const { rows: qualifiedRows } = await client.query<{ id: string }>(
          `SELECT s.id FROM staff s
           JOIN staff_services ss ON ss.staff_id = s.id AND ss.service_id = $1
           WHERE s.tenant_id = $2 AND s.location_id = $3 AND s.is_active = true
           ORDER BY s.created_at`,
          [serviceId, tenantId, locationId],
        );
        for (const { id } of qualifiedRows) {
          if (!(await checkStaffOverlap(client, id, start, end))) {
            resolvedStaffId = id;
            break;
          }
        }
        if (resolvedStaffId === null && qualifiedRows.length > 0) return 'overlap' as const;
      }
    } else {
      // override: skip all staff checks
      if (staffId != null) {
        resolvedStaffId = staffId;
      } else {
        const { rows: qualifiedRows } = await client.query<{ id: string }>(
          `SELECT s.id FROM staff s
           JOIN staff_services ss ON ss.staff_id = s.id AND ss.service_id = $1
           WHERE s.tenant_id = $2 AND s.location_id = $3 AND s.is_active = true
           ORDER BY s.created_at`,
          [serviceId, tenantId, locationId],
        );
        resolvedStaffId = qualifiedRows[0]?.id ?? null;
      }
    }

    const { rows } = await client.query<BookingRow>(
      `INSERT INTO bookings (tenant_id, service_id, location_id, staff_id, client_name, client_phone, client_email, start_at, end_at, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
       RETURNING id, tenant_id, service_id, location_id, staff_id, NULL::text AS staff_name, client_name, client_phone, client_email, start_at, end_at, status, notes, created_at`,
      [tenantId, serviceId, locationId, resolvedStaffId, clientName, clientPhone, clientEmail ?? null, start, end, notes ?? null],
    );

    // Resolve staff_name for the response
    const row = rows[0];
    if (resolvedStaffId) {
      const { rows: staffNameRows } = await client.query<{ name: string }>(
        'SELECT name FROM staff WHERE id = $1',
        [resolvedStaffId],
      );
      row.staff_name = staffNameRows[0]?.name ?? null;
    }

    return row;
  });

  if (result === 'not_found')     return Response.json({ error: 'not_found' }, { status: 404 });
  if (result === 'invalid_staff') return Response.json({ error: 'validation_error', details: ['staffId'] }, { status: 422 });
  if (result === 'overlap')       return Response.json({ error: 'overlap' }, { status: 409 });
  return Response.json(format(result), { status: 201 });
}
