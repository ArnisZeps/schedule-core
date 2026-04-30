import { Router } from 'express';
import { z } from 'zod';
import type { Pool, PoolClient } from '@schedule-core/db';
import { authMiddleware } from '../middleware/auth.js';
import { withTenantContext } from '../middleware/tenant-context.js';

type RuleRow = {
  id: string;
  tenant_id: string;
  resource_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: Date;
};

function format(r: RuleRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    resourceId: r.resource_id,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time.substring(0, 5),
    endTime: r.end_time.substring(0, 5),
    createdAt: r.created_at,
  };
}

const TIME = /^\d{2}:\d{2}$/;

const createSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(TIME),
    endTime: z.string().regex(TIME),
  })
  .refine((d) => d.startTime < d.endTime, { message: 'startTime must be before endTime' });

const patchSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    startTime: z.string().regex(TIME).optional(),
    endTime: z.string().regex(TIME).optional(),
  })
  .refine((d) => d.dayOfWeek !== undefined || d.startTime !== undefined || d.endTime !== undefined, {
    message: 'at_least_one_field_required',
  });

async function resourceExists(client: PoolClient, resourceId: string): Promise<boolean> {
  const { rows } = await client.query('SELECT 1 FROM resources WHERE id = $1', [resourceId]);
  return rows.length > 0;
}

async function hasOverlap(
  client: PoolClient,
  resourceId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeId?: string,
): Promise<boolean> {
  const values: unknown[] = [resourceId, dayOfWeek, startTime, endTime];
  let sql =
    'SELECT 1 FROM availability_rules WHERE resource_id = $1 AND day_of_week = $2 AND end_time > $3 AND start_time < $4';
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id != $${values.length}`;
  }
  const { rows } = await client.query(sql, values);
  return rows.length > 0;
}

const SELECT_COLS =
  'id, tenant_id, resource_id, day_of_week, start_time, end_time, created_at';

export function availabilityRulesRouter(pool: Pool): Router {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

  router.post('/', async (req, res) => {
    const { tenantId, resourceId } = req.params as { tenantId: string; resourceId: string };
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

    const { dayOfWeek, startTime, endTime } = parsed.data;

    const result = await withTenantContext(pool, tenantId, async (client) => {
      if (!(await resourceExists(client, resourceId))) return 'not_found' as const;
      if (await hasOverlap(client, resourceId, dayOfWeek, startTime, endTime)) return 'overlap' as const;
      const { rows } = await client.query<RuleRow>(
        `INSERT INTO availability_rules (tenant_id, resource_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${SELECT_COLS}`,
        [tenantId, resourceId, dayOfWeek, startTime, endTime],
      );
      return rows[0];
    });

    if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return; }
    if (result === 'overlap') { res.status(409).json({ error: 'overlap' }); return; }
    res.status(201).json(format(result));
  });

  router.get('/', async (req, res) => {
    const { tenantId, resourceId } = req.params as { tenantId: string; resourceId: string };
    if (req.auth!.tenantId !== tenantId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const result = await withTenantContext(pool, tenantId, async (client) => {
      if (!(await resourceExists(client, resourceId))) return null;
      const { rows } = await client.query<RuleRow>(
        `SELECT ${SELECT_COLS} FROM availability_rules WHERE resource_id = $1 ORDER BY day_of_week, start_time`,
        [resourceId],
      );
      return rows;
    });

    if (result === null) { res.status(404).json({ error: 'not_found' }); return; }
    res.json(result.map(format));
  });

  router.get('/:id', async (req, res) => {
    const { tenantId, resourceId, id } = req.params as { tenantId: string; resourceId: string; id: string };
    if (req.auth!.tenantId !== tenantId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const row = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<RuleRow>(
        `SELECT ${SELECT_COLS} FROM availability_rules WHERE id = $1 AND resource_id = $2`,
        [id, resourceId],
      );
      return rows[0] ?? null;
    });

    if (!row) { res.status(404).json({ error: 'not_found' }); return; }
    res.json(format(row));
  });

  router.patch('/:id', async (req, res) => {
    const { tenantId, resourceId, id } = req.params as { tenantId: string; resourceId: string; id: string };
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
      const { rows: existing } = await client.query<RuleRow>(
        `SELECT ${SELECT_COLS} FROM availability_rules WHERE id = $1 AND resource_id = $2`,
        [id, resourceId],
      );
      if (existing.length === 0) return 'not_found' as const;

      const cur = existing[0];
      const merged = {
        dayOfWeek: patch.dayOfWeek ?? cur.day_of_week,
        startTime: patch.startTime ?? cur.start_time.substring(0, 5),
        endTime: patch.endTime ?? cur.end_time.substring(0, 5),
      };

      if (merged.startTime >= merged.endTime) return 'invalid_times' as const;

      if (await hasOverlap(client, resourceId, merged.dayOfWeek, merged.startTime, merged.endTime, id)) {
        return 'overlap' as const;
      }

      const sets: string[] = [];
      const values: unknown[] = [];
      let i = 1;
      if (patch.dayOfWeek !== undefined) { sets.push(`day_of_week = $${i++}`); values.push(patch.dayOfWeek); }
      if (patch.startTime !== undefined) { sets.push(`start_time = $${i++}`); values.push(patch.startTime); }
      if (patch.endTime !== undefined) { sets.push(`end_time = $${i++}`); values.push(patch.endTime); }
      values.push(id);

      const { rows } = await client.query<RuleRow>(
        `UPDATE availability_rules SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${SELECT_COLS}`,
        values,
      );
      return rows[0];
    });

    if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return; }
    if (result === 'invalid_times') {
      res.status(422).json({ error: 'validation_error', details: ['startTime must be before endTime'] });
      return;
    }
    if (result === 'overlap') { res.status(409).json({ error: 'overlap' }); return; }
    res.json(format(result));
  });

  router.delete('/:id', async (req, res) => {
    const { tenantId, resourceId, id } = req.params as { tenantId: string; resourceId: string; id: string };
    if (req.auth!.tenantId !== tenantId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    let rowCount = 0;
    await withTenantContext(pool, tenantId, async (client) => {
      const result = await client.query(
        'DELETE FROM availability_rules WHERE id = $1 AND resource_id = $2',
        [id, resourceId],
      );
      rowCount = result.rowCount ?? 0;
    });

    if (rowCount === 0) { res.status(404).json({ error: 'not_found' }); return; }
    res.status(204).send();
  });

  return router;
}
