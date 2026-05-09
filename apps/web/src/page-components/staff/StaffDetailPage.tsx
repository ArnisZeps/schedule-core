'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useStaff, useUpdateStaff, useDeleteStaff } from '@/hooks/useStaff'
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
  const router = useRouter()
  const { data: staff, isLoading } = useStaff(staffId!)
  const updateMutation = useUpdateStaff()
  const deleteMutation = useDeleteStaff()
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

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

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync({ staffId: staffId! })
      router.push('/staff')
    } catch {
      toast.error('Failed to delete staff member')
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
            onCancel={() => router.push('/staff')}
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
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Availability overrides</CardTitle>
        </CardHeader>
        <CardContent>
          <OverrideCalendar staffId={staffId!} />
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteMutation.isPending}
          >
            Delete staff member
          </Button>
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
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {staff.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the staff member and all their schedules and overrides.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}
