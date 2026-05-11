import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { withTenantContext } from '@/lib/server/withTenantContext';
import { checkOverlap } from '@/lib/server/availability';

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

const patchSchema = z
  .object({
    status: z.enum(['confirmed', 'cancelled']).optional(),
    startAt: z.string().regex(ISO8601).optional(),
    endAt: z.string().regex(ISO8601).optional(),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (d) =>
      d.status !== undefined ||
      d.startAt !== undefined ||
      d.endAt !== undefined ||
      d.notes !== undefined,
    { message: 'at_least_one_field_required' },
  )
  .refine(
    (d) => {
      if (d.startAt && d.endAt) return new Date(d.startAt) < new Date(d.endAt);
      return true;
    },
    { message: 'startAt must be before endAt' },
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; bookingId: string }> },
) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { tenantId, bookingId } = await params;
  if (auth.tenantId !== tenantId) return Response.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
    return Response.json({ error: 'validation_error', details }, { status: 422 });
  }

  const patch = parsed.data;

  const result = await withTenantContext(db, tenantId, async (client) => {
    const { rows: existing } = await client.query<BookingRow>(
      `SELECT ${SELECT_COLS} FROM bookings WHERE id = $1`,
      [bookingId],
    );
    if (existing.length === 0) return 'not_found' as const;

    const cur = existing[0];

    if (patch.status === 'cancelled') {
      if (cur.status === 'cancelled') return 'already_cancelled' as const;
      const { rows } = await client.query<BookingRow>(
        `UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING ${SELECT_COLS}`,
        [bookingId],
      );
      return rows[0];
    }

    const newStart = patch.startAt ? new Date(patch.startAt) : new Date(cur.start_at);
    const newEnd   = patch.endAt   ? new Date(patch.endAt)   : new Date(cur.end_at);

    if (newStart >= newEnd) return 'invalid_times' as const;

    const serviceId = cur.service_id;

    if (patch.startAt || patch.endAt) {
      if (await checkOverlap(client, serviceId, newStart, newEnd, bookingId)) {
        return 'overlap' as const;
      }
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (patch.status !== undefined) { sets.push(`status = $${idx++}`);   values.push(patch.status); }
    if (patch.startAt)              { sets.push(`start_at = $${idx++}`); values.push(newStart); }
    if (patch.endAt)                { sets.push(`end_at = $${idx++}`);   values.push(newEnd); }
    if (patch.notes !== undefined)  { sets.push(`notes = $${idx++}`);    values.push(patch.notes); }
    values.push(bookingId);

    const { rows } = await client.query<BookingRow>(
      `UPDATE bookings SET ${sets.join(', ')} WHERE id = $${idx} RETURNING ${SELECT_COLS}`,
      values,
    );
    return rows[0];
  });

  if (result === 'not_found')            return Response.json({ error: 'not_found' }, { status: 404 });
  if (result === 'already_cancelled')    return Response.json({ error: 'already_cancelled' }, { status: 409 });
  if (result === 'invalid_times')        return Response.json({ error: 'validation_error', details: ['startAt must be before endAt'] }, { status: 422 });
  if (result === 'overlap')              return Response.json({ error: 'overlap' }, { status: 409 });
  return Response.json(format(result));
}
