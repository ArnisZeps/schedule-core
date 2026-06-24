import { headers } from 'next/headers'
import { db } from '@/lib/server/db'
import { SettingsPage } from '@/page-components/settings/SettingsPage'

export default async function Page() {
  const h = await headers()
  const userId = h.get('x-user-id')!
  const tenantId = h.get('x-tenant-id')!

  // users and tenants are platform-level (no RLS) — a plain connection is fine.
  const client = await db.connect()
  try {
    const { rows: userRows } = await client.query<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [userId],
    )
    const { rows: tenantRows } = await client.query<{ name: string; slug: string }>(
      'SELECT name, slug FROM tenants WHERE id = $1',
      [tenantId],
    )

    return (
      <SettingsPage
        email={userRows[0]?.email ?? ''}
        tenant={{ name: tenantRows[0]?.name ?? '', slug: tenantRows[0]?.slug ?? '' }}
      />
    )
  } finally {
    client.release()
  }
}
