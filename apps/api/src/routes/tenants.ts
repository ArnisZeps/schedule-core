import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from '@schedule-core/db';
import { authMiddleware } from '../middleware/auth.js';

type TenantRow = { id: string; name: string; slug: string; created_at: Date };

function format(t: TenantRow) {
  return { id: t.id, name: t.name, slug: t.slug, createdAt: t.created_at };
}

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: z.string().regex(/^[a-z0-9-]{3,50}$/).optional(),
  })
  .refine((d) => d.name !== undefined || d.slug !== undefined, {
    message: 'at_least_one_field_required',
  });

export function tenantsRouter(pool: Pool): Router {
  const router = Router();
  router.use(authMiddleware);

  router.get('/:id', async (req, res) => {
    const { id } = req.params;
    if (req.auth!.tenantId !== id) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const client = await pool.connect();
    try {
      const { rows } = await client.query<TenantRow>(
        'SELECT id, name, slug, created_at FROM tenants WHERE id = $1',
        [id],
      );
      if (rows.length === 0) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json(format(rows[0]));
    } finally {
      client.release();
    }
  });

  router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    if (req.auth!.tenantId !== id) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
      res.status(422).json({ error: 'validation_error', details });
      return;
    }

    const { name, slug } = parsed.data;
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (name !== undefined) { sets.push(`name = $${i++}`); values.push(name); }
    if (slug !== undefined) { sets.push(`slug = $${i++}`); values.push(slug); }
    values.push(id);

    const client = await pool.connect();
    try {
      let rows: TenantRow[];
      try {
        const result = await client.query<TenantRow>(
          `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, name, slug, created_at`,
          values,
        );
        rows = result.rows;
      } catch (err: any) {
        if (err.constraint === 'tenants_slug_key') {
          res.status(409).json({ error: 'slug_taken' });
          return;
        }
        throw err;
      }
      if (rows.length === 0) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json(format(rows[0]));
    } finally {
      client.release();
    }
  });

  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    if (req.auth!.tenantId !== id) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const client = await pool.connect();
    try {
      let rowCount: number;
      try {
        const result = await client.query('DELETE FROM tenants WHERE id = $1', [id]);
        rowCount = result.rowCount ?? 0;
      } catch (err: any) {
        if (err.code === '23503') {
          res.status(409).json({ error: 'has_bookings' });
          return;
        }
        throw err;
      }
      if (rowCount === 0) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(204).send();
    } finally {
      client.release();
    }
  });

  return router;
}
