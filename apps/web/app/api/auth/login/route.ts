import { z } from 'zod';
import { db } from '@/lib/server/db';
import { verifyPassword } from '@/lib/server/password';
import { signToken, getTokenMaxAge } from '@/lib/server/jwt';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const { email, password } = parsed.data;
  const client = await db.connect();
  try {
    const { rows } = await client.query<{ id: string; tenant_id: string; password_hash: string }>(
      'SELECT id, tenant_id, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()],
    );

    if (rows.length === 0 || !(await verifyPassword(password, rows[0].password_hash))) {
      return Response.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    const { id: userId, tenant_id: tenantId } = rows[0];
    const token = signToken({ sub: userId, tenantId });
    const maxAge = getTokenMaxAge();
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `sc_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`,
      },
    });
  } finally {
    client.release();
  }
}
