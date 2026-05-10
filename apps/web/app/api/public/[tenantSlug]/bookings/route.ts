import { z } from 'zod';
import { db } from '@/lib/server/db';
import { checkOverlap, checkWithinAvailability } from '@/lib/server/availability';

// TODO: add Upstash Rate Limit before M7

type BookingRow = {
  id: string;
  service_id: string;
  location_id: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  start_at: Date;
  end_at: Date;
  status: string;
  notes: string | null;
  created_at: Date;
};

function format(r: BookingRow) {
  return {
    id: r.id,
    serviceId: r.service_id,
    locationId: r.location_id,
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
  'id, service_id, location_id, client_name, client_phone, client_email, start_at, end_at, status, notes, created_at';

const bookingSchema = z
  .object({
    serviceId: z.string().uuid(),
    clientName: z.string().min(1),
    clientEmail: z.string().email(),
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

  const { serviceId, clientName, clientEmail, startAt, endAt } = parsed.data;
  const start = new Date(startAt);
  const end = new Date(endAt);

  const client = await db.connect();
  try {
    const { rows: tenantRows } = await client.query<{ id: string }>(
      'SELECT id FROM tenants WHERE slug = $1',
      [tenantSlug],
    );
    if (tenantRows.length === 0) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    const tenantId = tenantRows[0].id;

    const { rows: locationRows } = await client.query<{ id: string }>(
      `SELECT id FROM locations WHERE tenant_id = $1 AND is_active = true`,
      [tenantId],
    );
    if (locationRows.length !== 1) {
      return Response.json(
        { error: 'This business has multiple locations. Use the booking widget to select a location.' },
        { status: 422 },
      );
    }
    const locationId = locationRows[0].id;

    if (!(await checkWithinAvailability(client, serviceId, start, end))) {
      return Response.json({ error: 'outside_availability' }, { status: 409 });
    }
    if (await checkOverlap(client, serviceId, start, end)) {
      return Response.json({ error: 'overlap' }, { status: 409 });
    }

    const { rows } = await client.query<BookingRow>(
      `INSERT INTO bookings (tenant_id, service_id, location_id, client_name, client_phone, client_email, start_at, end_at, status)
       VALUES ($1, $2, $3, $4, '', $5, $6, $7, 'pending') RETURNING ${SELECT_COLS}`,
      [tenantId, serviceId, locationId, clientName, clientEmail, start, end],
    );
    return Response.json(format(rows[0]), { status: 201 });
  } finally {
    client.release();
  }
}
