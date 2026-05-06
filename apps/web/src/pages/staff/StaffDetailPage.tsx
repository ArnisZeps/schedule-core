import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useStaff, useUpdateStaff } from '@/hooks/useStaff'
import { StaffForm, type StaffFormValues } from '@/components/staff/StaffForm'
import { ServiceAssignment } from '@/components/staff/ServiceAssignment'
import { WeeklyScheduleCalendar } from '@/components/staff/WeeklyScheduleCalendar'
import { OverrideCalendar } from '@/components/staff/OverrideCalendar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/ui/LoadingState'

export function StaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>()
  const navigate = useNavigate()
  const { data: staff, isLoading } = useStaff(staffId!)
  const updateMutation = useUpdateStaff()
  const [deactivateOpen, setDeactivateOpen] = useState(false)

  async function handleProfileSave(values: StaffFormValues) {
    try {
      await updateMutation.mutateAsync({
        staffId: staffId!,
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
      })
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    }
  }

  async function handleDeactivate() {
    try {
      await updateMutation.mutateAsync({ staffId: staffId!, isActive: false })
      toast.success('Staff member deactivated')
      setDeactivateOpen(false)
    } catch {
      toast.error('Failed to deactivate')
    }
  }

  async function handleReactivate() {
    try {
      await updateMutation.mutateAsync({ staffId: staffId!, isActive: true })
      toast.success('Staff member reactivated')
    } catch {
      toast.error('Failed to reactivate')
    }
  }

  if (isLoading) return <LoadingState />
  if (!staff) return <div className="p-6">Staff member not found.</div>

  return (
    <PageShell>
      <PageHeader
        title={staff.name}
        action={
          <Badge variant={staff.isActive ? 'default' : 'secondary'}>
            {staff.isActive ? 'Active' : 'Inactive'}
          </Badge>
        }
      />

      {/* Profile */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StaffForm
            defaultValues={{
              name: staff.name,
              email: staff.email ?? undefined,
              phone: staff.phone ?? undefined,
            }}
            onSubmit={handleProfileSave}
            isPending={updateMutation.isPending}
            onCancel={() => navigate('/staff')}
          />
          <div className="border-t pt-4">
            {staff.isActive ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeactivateOpen(true)}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReactivate}
                disabled={updateMutation.isPending}
              >
                Reactivate
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Service assignment */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Services</CardTitle>
        </CardHeader>
        <CardContent>
          <ServiceAssignment staffId={staffId!} />
        </CardContent>
      </Card>

      {/* Weekly schedule */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Weekly schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <WeeklyScheduleCalendar staffId={staffId!} />
        </CardContent>
      </Card>

      {/* Override calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Availability overrides</CardTitle>
        </CardHeader>
        <CardContent>
          <OverrideCalendar staffId={staffId!} />
        </CardContent>
      </Card>

      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {staff.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This staff member will no longer appear in the active list.
              You can reactivate them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeactivate}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}
