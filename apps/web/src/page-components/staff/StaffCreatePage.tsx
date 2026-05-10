'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useCreateStaff } from '@/hooks/useStaff'
import { StaffForm, type StaffFormValues } from '@/components/staff/StaffForm'
import { Card, CardContent } from '@/components/ui/card'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'

export function StaffCreatePage() {
  const router = useRouter()
  const createMutation = useCreateStaff()

  async function onSubmit(values: StaffFormValues) {
    const staff = await createMutation.mutateAsync({
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      locationId: values.locationId,
    })
    toast.success('Staff member created')
    router.push(`/staff/${staff.id}`)
  }

  return (
    <PageShell className="max-w-lg">
      <PageHeader title="New Staff Member" />
      <Card>
        <CardContent className="pt-6">
          <StaffForm
            onSubmit={onSubmit}
            isPending={createMutation.isPending}
            onCancel={() => router.push('/staff')}
          />
        </CardContent>
      </Card>
    </PageShell>
  )
}
