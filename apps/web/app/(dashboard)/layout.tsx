import { headers } from 'next/headers'
import { AppLayout } from '@/components/AppLayout'
import { UserProvider } from '@/components/UserProvider'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const userId = h.get('x-user-id')!
  const tenantId = h.get('x-tenant-id')!

  return (
    <UserProvider user={{ userId, tenantId }}>
      <AppLayout>{children}</AppLayout>
    </UserProvider>
  )
}
