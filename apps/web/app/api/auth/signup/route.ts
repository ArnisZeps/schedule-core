import { z } from 'zod';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import { signToken } from '@/lib/server/jwt';

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

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
    return Response.json({ error: 'validation_error', details }, { status: 422 });
  }

  const { email, password, businessName, slug } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const normalizedSlug = slug.toLowerCase();

  if (RESERVED_SLUGS.has(normalizedSlug)) {
    return Response.json({ error: 'validation_error', details: ['slug_reserved'] }, { status: 422 });
  }

  const passwordHash = await hashPassword(password);
  const client = await db.connect();
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
        return Response.json({ error: 'slug_taken' }, { status: 409 });
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
        return Response.json({ error: 'email_taken' }, { status: 409 });
      }
      throw err;
    }

    await client.query('COMMIT');
    const token = signToken({ sub: userId, tenantId });
    return Response.json({ token }, { status: 201 });
  } finally {
    client.release();
  }
}
