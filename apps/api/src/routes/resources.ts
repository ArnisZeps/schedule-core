import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from '@schedule-core/db';
import { authMiddleware } from '../middleware/auth.js';
import { withTenantContext } from '../middleware/tenant-context.js';

type ResourceRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_at: Date;
};

function format(r: ResourceRow) {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    description: r.description,
    createdAt: r.created_at,
  };
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
  })
  .refine((d) => d.name !== undefined || d.description !== undefined, {
    message: 'at_least_one_field_required',
  });

export function resourcesRouter(pool: Pool): Router {
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

    const { name, description } = parsed.data;
    const row = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<ResourceRow>(
        'INSERT INTO resources (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING id, tenant_id, name, description, created_at',
        [tenantId, name, description ?? null],
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
      const { rows } = await client.query<ResourceRow>(
        'SELECT id, tenant_id, name, description, created_at FROM resources ORDER BY created_at',
      );
      return rows;
    });

    res.json(rows.map(format));
  });

  router.get('/:id', async (req, res) => {
    const { tenantId, id } = req.params as { tenantId: string; id: string };
    if (req.auth!.tenantId !== tenantId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const row = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<ResourceRow>(
        'SELECT id, tenant_id, name, description, created_at FROM resources WHERE id = $1 AND tenant_id = $2',
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

    const { name, description } = parsed.data;
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (name !== undefined) { sets.push(`name = $${i++}`); values.push(name); }
    if (description !== undefined) { sets.push(`description = $${i++}`); values.push(description); }
    values.push(id);

    const row = await withTenantContext(pool, tenantId, async (client) => {
      const { rows } = await client.query<ResourceRow>(
        `UPDATE resources SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, tenant_id, name, description, created_at`,
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
        const result = await client.query('DELETE FROM resources WHERE id = $1', [id]);
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
