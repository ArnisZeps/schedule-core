import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withAuth } from '@/lib/server/withAuth';

const patchSchema = z.object({
  email: z.string().email(),
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

  const email = parsed.data.email.toLowerCase();
  const client = await db.connect();
  try {
    let rowCount: number;
    try {
      const result = await client.query(
        'UPDATE users SET email = $1 WHERE id = $2',
        [email, auth.userId],
      );
      rowCount = result.rowCount ?? 0;
    } catch (err: any) {
      if (err.constraint === 'users_email_key') {
        return Response.json({ error: 'email_taken' }, { status: 409 });
      }
      throw err;
    }
    if (rowCount === 0) return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json({ email });
  } finally {
    client.release();
  }
}
