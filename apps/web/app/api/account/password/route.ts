import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';
import { hashPassword, verifyPassword } from '@/lib/server/password';

const patchSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PATCH(request: Request) {
  const auth = withAuth(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => i.path.join('.') || i.message);
    return Response.json({ error: 'validation_error', details }, { status: 422 });
  }

  const { currentPassword, newPassword } = parsed.data;
  const client = await db.connect();
  try {
    const { rows } = await client.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [auth.userId],
    );
    if (rows.length === 0 || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
      return Response.json({ error: 'invalid_current_password' }, { status: 403 });
    }

    await client.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [await hashPassword(newPassword), auth.userId],
    );
    return new Response(null, { status: 204 });
  } finally {
    client.release();
  }
}
