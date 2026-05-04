import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from '@schedule-core/db';
import { checkOverlap, checkWithinAvailability, generateSlots } from '../lib/availability.js';

type BookingRow = {
  id: string;
  service_id: string;
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

// In-process rate limiter: counter per (slug:ip) with a rolling window.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(slug: string, ip: string): boolean {
  const max = parseInt(process.env.RATE_LIMIT_MAX ?? '60', 10);
  const key = `${slug}:${ip}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > max;
}

const ISO8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

const SELECT_COLS =
  'id, service_id, client_name, client_phone, client_email, start_at, end_at, status, notes, created_at';

export function publicRouter(pool: Pool): Router {
  const router = Router({ mergeParams: true });

  // GET /public/:tenantSlug/services/:serviceId/slots
  router.get('/services/:serviceId/slots', async (req, res) => {
    const { tenantSlug, serviceId } = req.params as { tenantSlug: string; serviceId: string };
    const { date, duration } = req.query as Record<string, string | undefined>;

    if (!date || !DATE_RE.test(date) || isNaN(Date.parse(date))) {
      res.status(400).json({ error: 'invalid_param', param: 'date' });
      return;
    }
    if (!duration || isNaN(Number(duration)) || Number(duration) <= 0) {
      res.status(400).json({ error: 'invalid_param', param: 'duration' });
      return;
    }

    const client = await pool.connect();
    try {
      const { rows: tenantRows } = await client.query<{ id: string }>(
        'SELECT id FROM tenants WHERE slug = $1',
        [tenantSlug],
      );
      if (tenantRows.length === 0) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      const slots = await generateSlots(client, serviceId, date, Number(duration));
      res.json(slots);
    } finally {
      client.release();
    }
  });

  // POST /public/:tenantSlug/bookings
  router.post('/bookings', async (req, res) => {
    const { tenantSlug } = req.params as { tenantSlug: string };
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

    if (isRateLimited(tenantSlug, ip)) {
      res.status(429).json({ error: 'rate_limited' });
      return;
    }

    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
      res.status(422).json({ error: 'validation_error', details });
      return;
    }

    const { serviceId, clientName, clientEmail, startAt, endAt } = parsed.data;
    const start = new Date(startAt);
    const end = new Date(endAt);

    const client = await pool.connect();
    try {
      const { rows: tenantRows } = await client.query<{ id: string }>(
        'SELECT id FROM tenants WHERE slug = $1',
        [tenantSlug],
      );
      if (tenantRows.length === 0) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const tenantId = tenantRows[0].id;

      if (!(await checkWithinAvailability(client, serviceId, start, end))) {
        res.status(409).json({ error: 'outside_availability' });
        return;
      }
      if (await checkOverlap(client, serviceId, start, end)) {
        res.status(409).json({ error: 'overlap' });
        return;
      }

      const { rows } = await client.query<BookingRow>(
        `INSERT INTO bookings (tenant_id, service_id, client_name, client_phone, client_email, start_at, end_at, status)
         VALUES ($1, $2, $3, '', $4, $5, $6, 'pending') RETURNING ${SELECT_COLS}`,
        [tenantId, serviceId, clientName, clientEmail, start, end],
      );
      res.status(201).json(format(rows[0]));
    } finally {
      client.release();
    }
  });

  return router;
}
