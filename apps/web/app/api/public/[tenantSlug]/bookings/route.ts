import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withTenantContext } from '@/lib/server/withTenantContext';
import { checkStaffOverlap } from '@/lib/server/availability';

// TODO: add Upstash Rate Limit before M7 goes live (ADR-011)

type BookingRow = {
  id: string;
  service_id: string;
  service_name: string;
  location_id: string;
  location_name: string;
  staff_id: string | null;
  staff_name: string | null;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  start_at: Date;
  end_at: Date;
  status: string;
  created_at: Date;
};

function format(r: BookingRow) {
  return {
    id: r.id,
    serviceId: r.service_id,
    serviceName: r.service_name,
    locationId: r.location_id,
    locationName: r.location_name,
    staffId: r.staff_id,
    staffName: r.staff_name,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    clientEmail: r.client_email,
    startAt: r.start_at,
    endAt: r.end_at,
    status: r.status,
    createdAt: r.created_at,
  };
}

const ISO8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const bookingSchema = z
  .object({
    serviceId: z.string().uuid(),
    locationId: z.string().uuid(),
    staffId: z.string().uuid().nullable().optional(),
    clientName: z.string().min(1),
    clientPhone: z.string().min(7),
    clientEmail: z.string().email().nullable().optional(),
    startAt: z.string().regex(ISO8601),
    endAt: z.string().regex(ISO8601),
  })
  .refine((d) => new Date(d.startAt) < new Date(d.endAt), {
    message: 'startAt must be before endAt',
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;

  const body = await request.json();
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
    return Response.json({ error: 'validation_error', details }, { status: 422 });
  }

  const { serviceId, locationId, staffId, clientName, clientPhone, clientEmail, startAt, endAt } =
    parsed.data;
  const start = new Date(startAt);
  const end = new Date(endAt);

  const tenantClient = await db.connect();
  let tenantId: string;
  try {
    const { rows } = await tenantClient.query<{ id: string }>(
      'SELECT id FROM tenants WHERE slug = $1',
      [tenantSlug],
    );
    if (rows.length === 0) return Response.json({ error: 'not_found' }, { status: 404 });
    tenantId = rows[0].id;
  } finally {
    tenantClient.release();
  }

  const result = await withTenantContext(db, tenantId, async (client) => {
    const { rows: serviceRows } = await client.query<{ name: string }>(
      'SELECT name FROM services WHERE id = $1 AND tenant_id = $2',
      [serviceId, tenantId],
    );
    if (serviceRows.length === 0) return 'not_found' as const;

    const { rows: locationRows } = await client.query<{ name: string }>(
      'SELECT name FROM locations WHERE id = $1 AND tenant_id = $2 AND is_active = true',
      [locationId, tenantId],
    );
    if (locationRows.length === 0) return 'not_found' as const;

    const serviceName = serviceRows[0].name;
    const locationName = locationRows[0].name;

    let resolvedStaffId: string | null = null;

    if (staffId != null) {
      // Explicit staff: validate active + assigned to service at location
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
      // Auto-assign: first free active + qualified staff at location
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

    const { rows } = await client.query<BookingRow>(
      `INSERT INTO bookings
         (tenant_id, service_id, location_id, staff_id, client_name, client_phone, client_email, start_at, end_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING
         id,
         service_id,
         $10::text AS service_name,
         location_id,
         $11::text AS location_name,
         staff_id,
         NULL::text AS staff_name,
         client_name, client_phone, client_email, start_at, end_at, status, created_at`,
      [
        tenantId, serviceId, locationId, resolvedStaffId,
        clientName, clientPhone, clientEmail ?? null,
        start, end,
        serviceName, locationName,
      ],
    );

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
