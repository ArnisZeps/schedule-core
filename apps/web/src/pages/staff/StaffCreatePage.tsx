import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useCreateStaff } from '@/hooks/useStaff'
import { StaffForm, type StaffFormValues } from '@/components/staff/StaffForm'
import { Card, CardContent } from '@/components/ui/card'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'

export function StaffCreatePage() {
  const navigate = useNavigate()
  const createMutation = useCreateStaff()

  async function onSubmit(values: StaffFormValues) {
    const staff = await createMutation.mutateAsync({
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
    })
    toast.success('Staff member created')
    navigate(`/staff/${staff.id}`)
  }

  return (
    <PageShell className="max-w-lg">
      <PageHeader title="New Staff Member" />
      <Card>
        <CardContent className="pt-6">
          <StaffForm
            onSubmit={onSubmit}
            isPending={createMutation.isPending}
            onCancel={() => navigate('/staff')}
          />
        </CardContent>
      </Card>
    </PageShell>
  )
}
