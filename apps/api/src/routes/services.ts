import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from '@schedule-core/db';
import { authMiddleware } from '../middleware/auth.js';
import { withTenantContext } from '../middleware/tenant-context.js';
import { generateAllSlots } from '../lib/availability.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ServiceRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  created_at: Date;
};

function format(r: ServiceRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    description: r.description,
    durationMinutes: r.duration_minutes,
    createdAt: r.created_at,
  };
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  durationMinutes: z.number().int().positive().optional(),
});

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    durationMinutes: z.number().int().positive().optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.description !== undefined || d.durationMinutes !== undefined,
    { message: 'at_least_one_field_required' },
  );

const SELECT_COLS = 'id, tenant_id, name, description, duration_minutes, created_at';

export function servicesRouter(pool: Pool): Router {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

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

    const { name, description, durationMinutes } = parsed.data;
    const cols = ['tenant_id', 'name', 'description'];
    const vals: unknown[] = [tenantId, name, description ?? null];
    if (durationMinutes !== undefined) {
      cols.push('duration_minutes');
      vals.push(durationMinutes);
    }
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');

    const row = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<ServiceRow>(
        `INSERT INTO services (${cols.join(', ')}) VALUES (${placeholders}) RETURNING ${SELECT_COLS}`,
        vals,
      );
      return rows[0];
    });

    res.status(201).json(format(row));
  });

  router.get('/', async (req, res) => {
    const { tenantId } = req.params as { tenantId: string };
    if (req.auth!.tenantId !== tenantId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const rows = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<ServiceRow>(
        `SELECT ${SELECT_COLS} FROM services ORDER BY created_at`,
      );
      return rows;
    });

    res.json(rows.map(format));
  });

  router.get('/:id/slots', async (req, res) => {
    const { tenantId, id } = req.params as { tenantId: string; id: string };
    if (req.auth!.tenantId !== tenantId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const { date } = req.query as Record<string, string | undefined>;
    if (!date || !DATE_RE.test(date) || isNaN(Date.parse(date))) {
      res.status(400).json({ error: 'invalid_param', param: 'date' });
      return;
    }

    const result = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<{ duration_minutes: number }>(
        `SELECT duration_minutes FROM services WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );
      if (rows.length === 0) return null;
      return generateAllSlots(client, id, date, rows[0].duration_minutes);
    });

    if (result === null) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(result);
  });

  router.get('/:id', async (req, res) => {
    const { tenantId, id } = req.params as { tenantId: string; id: string };
    if (req.auth!.tenantId !== tenantId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const row = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<ServiceRow>(
        `SELECT ${SELECT_COLS} FROM services WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );
      return rows[0] ?? null;
    });

    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(format(row));
  });

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

    const { name, description, durationMinutes } = parsed.data;
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (name !== undefined)            { sets.push(`name = $${i++}`);             values.push(name); }
    if (description !== undefined)     { sets.push(`description = $${i++}`);      values.push(description); }
    if (durationMinutes !== undefined) { sets.push(`duration_minutes = $${i++}`); values.push(durationMinutes); }
    values.push(id);

    const row = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<ServiceRow>(
        `UPDATE services SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${SELECT_COLS}`,
        values,
      );
      return rows[0] ?? null;
    });

    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(format(row));
  });

  router.delete('/:id', async (req, res) => {
    const { tenantId, id } = req.params as { tenantId: string; id: string };
    if (req.auth!.tenantId !== tenantId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    try {
      let rowCount = 0;
      await withTenantContext(pool, tenantId, async (client) => {
        const result = await client.query('DELETE FROM services WHERE id = $1', [id]);
        rowCount = result.rowCount ?? 0;
      });
      if (rowCount === 0) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(204).send();
    } catch (err: any) {
      if (err.code === '23503') {
        res.status(409).json({ error: 'has_bookings' });
        return;
      }
      throw err;
    }
  });

  return router;
}
