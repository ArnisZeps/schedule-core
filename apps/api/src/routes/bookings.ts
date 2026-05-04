import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from '@schedule-core/db';
import { authMiddleware } from '../middleware/auth.js';
import { withTenantContext } from '../middleware/tenant-context.js';
import { checkOverlap, checkWithinAvailability } from '../lib/availability.js';

type BookingRow = {
  id: string;
  tenant_id: string;
  service_id: string;
  client_name: string;
  client_email: string;
  start_at: Date;
  end_at: Date;
  status: string;
  created_at: Date;
};

function format(r: BookingRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    serviceId: r.service_id,
    clientName: r.client_name,
    clientEmail: r.client_email,
    startAt: r.start_at,
    endAt: r.end_at,
    status: r.status,
    createdAt: r.created_at,
  };
}

const ISO8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const createSchema = z
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

const patchSchema = z
  .object({
    status: z.enum(['confirmed', 'cancelled']).optional(),
    startAt: z.string().regex(ISO8601).optional(),
    endAt: z.string().regex(ISO8601).optional(),
  })
  .refine((d) => d.status !== undefined || d.startAt !== undefined || d.endAt !== undefined, {
    message: 'at_least_one_field_required',
  })
  .refine(
    (d) => {
      if (d.startAt && d.endAt) return new Date(d.startAt) < new Date(d.endAt);
      return true;
    },
    { message: 'startAt must be before endAt' },
  );

const SELECT_COLS =
  'id, tenant_id, service_id, client_name, client_email, start_at, end_at, status, created_at';

export function bookingsRouter(pool: Pool): Router {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

  // GET /tenants/:tenantId/bookings
  router.get('/', async (req, res) => {
    const { tenantId } = req.params as { tenantId: string };
    if (req.auth!.tenantId !== tenantId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const { from, to, serviceId, status } = req.query as Record<string, string | undefined>;

    if (from && isNaN(Date.parse(from))) {
      res.status(400).json({ error: 'invalid_param', param: 'from' });
      return;
    }
    if (to && isNaN(Date.parse(to))) {
      res.status(400).json({ error: 'invalid_param', param: 'to' });
      return;
    }

    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (from) { conditions.push(`start_at >= $${i++}`); values.push(from); }
    if (to)   { conditions.push(`start_at <= $${i++}`); values.push(to); }
    if (serviceId) { conditions.push(`service_id = $${i++}`); values.push(serviceId); }
    if (status === 'active') { conditions.push(`status != 'cancelled'`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<BookingRow>(
        `SELECT ${SELECT_COLS} FROM bookings ${where} ORDER BY start_at`,
        values,
      );
      return rows;
    });

    res.json(rows.map(format));
  });

  // POST /tenants/:tenantId/bookings
  router.post('/', async (req, res) => {
    const { tenantId } = req.params as { tenantId: string };
    if (req.auth!.tenantId !== tenantId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
      res.status(422).json({ error: 'validation_error', details });
      return;
    }

    const { serviceId, clientName, clientEmail, startAt, endAt } = parsed.data;
    const start = new Date(startAt);
    const end = new Date(endAt);

    const result = await withTenantContext(pool, tenantId, async (client) => {
      const { rows: serviceRows } = await client.query(
        'SELECT 1 FROM services WHERE id = $1',
        [serviceId],
      );
      if (serviceRows.length === 0) return 'not_found' as const;

      if (!(await checkWithinAvailability(client, serviceId, start, end))) {
        return 'outside_availability' as const;
      }
      if (await checkOverlap(client, serviceId, start, end)) {
        return 'overlap' as const;
      }

      const { rows } = await client.query<BookingRow>(
        `INSERT INTO bookings (tenant_id, service_id, client_name, client_email, start_at, end_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING ${SELECT_COLS}`,
        [tenantId, serviceId, clientName, clientEmail, start, end],
      );
      return rows[0];
    });

    if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return; }
    if (result === 'outside_availability') { res.status(409).json({ error: 'outside_availability' }); return; }
    if (result === 'overlap') { res.status(409).json({ error: 'overlap' }); return; }
    res.status(201).json(format(result));
  });

  // PATCH /tenants/:tenantId/bookings/:id
  router.patch('/:id', async (req, res) => {
    const { tenantId, id } = req.params as { tenantId: string; id: string };
    if (req.auth!.tenantId !== tenantId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
      res.status(422).json({ error: 'validation_error', details });
      return;
    }

    const patch = parsed.data;

    const result = await withTenantContext(pool, tenantId, async (client) => {
      const { rows: existing } = await client.query<BookingRow>(
        `SELECT ${SELECT_COLS} FROM bookings WHERE id = $1`,
        [id],
      );
      if (existing.length === 0) return 'not_found' as const;

      const cur = existing[0];

      // Cancel path
      if (patch.status === 'cancelled') {
        if (cur.status === 'cancelled') return 'already_cancelled' as const;
        const { rows } = await client.query<BookingRow>(
          `UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING ${SELECT_COLS}`,
          [id],
        );
        return rows[0];
      }

      // Reschedule path (and/or status=confirmed)
      const newStart = patch.startAt ? new Date(patch.startAt) : new Date(cur.start_at);
      const newEnd   = patch.endAt   ? new Date(patch.endAt)   : new Date(cur.end_at);

      if (newStart >= newEnd) return 'invalid_times' as const;

      const serviceId = cur.service_id;

      if (patch.startAt || patch.endAt) {
        if (!(await checkWithinAvailability(client, serviceId, newStart, newEnd))) {
          return 'outside_availability' as const;
        }
        if (await checkOverlap(client, serviceId, newStart, newEnd, id)) {
          return 'overlap' as const;
        }
      }

      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      if (patch.status)  { sets.push(`status = $${idx++}`);   values.push(patch.status); }
      if (patch.startAt) { sets.push(`start_at = $${idx++}`); values.push(newStart); }
      if (patch.endAt)   { sets.push(`end_at = $${idx++}`);   values.push(newEnd); }
      values.push(id);

      const { rows } = await client.query<BookingRow>(
        `UPDATE bookings SET ${sets.join(', ')} WHERE id = $${idx} RETURNING ${SELECT_COLS}`,
        values,
      );
      return rows[0];
    });

    if (result === 'not_found')          { res.status(404).json({ error: 'not_found' }); return; }
    if (result === 'already_cancelled')  { res.status(409).json({ error: 'already_cancelled' }); return; }
    if (result === 'invalid_times')      { res.status(422).json({ error: 'validation_error', details: ['startAt must be before endAt'] }); return; }
    if (result === 'outside_availability') { res.status(409).json({ error: 'outside_availability' }); return; }
    if (result === 'overlap')            { res.status(409).json({ error: 'overlap' }); return; }
    res.json(format(result));
  });

  return router;
}
