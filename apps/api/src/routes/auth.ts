import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from '@schedule-core/db';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';

const RESERVED_SLUGS = new Set([
  'api', 'auth', 'admin', 'login', 'logout', 'signup', 'dashboard',
  'app', 'www', 'mail', 'support', 'help', 'static', 'assets',
]);

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  businessName: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]{3,50}$/),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function authRouter(pool: Pool): Router {
  const router = Router();

  router.post('/signup', async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
      res.status(422).json({ error: 'validation_error', details });
      return;
    }

    const { email, password, businessName, slug } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const normalizedSlug = slug.toLowerCase();

    if (RESERVED_SLUGS.has(normalizedSlug)) {
      res.status(422).json({ error: 'validation_error', details: ['slug_reserved'] });
      return;
    }

    const passwordHash = await hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let tenantId: string;
      try {
        const tenantResult = await client.query<{ id: string }>(
          'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
          [businessName, normalizedSlug],
        );
        tenantId = tenantResult.rows[0].id;
      } catch (err: any) {
        await client.query('ROLLBACK');
        if (err.constraint === 'tenants_slug_key') {
          res.status(409).json({ error: 'slug_taken' });
          return;
        }
        throw err;
      }

      let userId: string;
      try {
        const userResult = await client.query<{ id: string }>(
          'INSERT INTO users (tenant_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
          [tenantId, normalizedEmail, passwordHash],
        );
        userId = userResult.rows[0].id;
      } catch (err: any) {
        await client.query('ROLLBACK');
        if (err.constraint === 'users_email_key') {
          res.status(409).json({ error: 'email_taken' });
          return;
        }
        throw err;
      }

      await client.query('COMMIT');
      const token = signToken({ sub: userId, tenantId });
      res.status(201).json({ token });
    } finally {
      client.release();
    }
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    const { email, password } = parsed.data;
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ id: string; tenant_id: string; password_hash: string }>(
        'SELECT id, tenant_id, password_hash FROM users WHERE email = $1',
        [email.toLowerCase()],
      );

      if (rows.length === 0 || !(await verifyPassword(password, rows[0].password_hash))) {
        res.status(401).json({ error: 'invalid_credentials' });
        return;
      }

      const { id: userId, tenant_id: tenantId } = rows[0];
      const token = signToken({ sub: userId, tenantId });
      res.status(200).json({ token });
    } finally {
      client.release();
    }
  });

  return router;
}
