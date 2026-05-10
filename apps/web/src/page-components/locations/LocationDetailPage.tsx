'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useLocation, useCreateLocation, useUpdateLocation, useDeleteLocation } from '@/hooks/useLocations'
import { LocationForm, type LocationFormValues } from '@/components/locations/LocationForm'
import { Button } from '@/components/ui/button'
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
import { ApiError } from '@/lib/api'

export function LocationDetailPage() {
  const { locationId } = useParams<{ locationId?: string }>()
  const router = useRouter()
  const isNew = !locationId

  const { data: location, isLoading } = useLocation(locationId ?? '')
  const createMutation = useCreateLocation()
  const updateMutation = useUpdateLocation()
  const deleteMutation = useDeleteLocation()

  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [formError, setFormError] = useState('')

  async function handleSave(values: LocationFormValues) {
    setFormError('')
    try {
      if (isNew) {
        const created = await createMutation.mutateAsync({
          name: values.name,
          address: values.address || undefined,
          timezone: values.timezone,
        })
        router.push(`/locations/${created.id}`)
      } else {
        await updateMutation.mutateAsync({
          locationId: locationId!,
          name: values.name,
          address: values.address || null,
          timezone: values.timezone,
        })
        toast.success('Location saved')
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFormError('Validation error. Please check your input.')
      } else {
        toast.error('Failed to save location')
      }
    }
  }

  async function handleDeactivate() {
    try {
      await updateMutation.mutateAsync({ locationId: locationId!, isActive: false })
      setDeactivateOpen(false)
      router.push('/locations')
    } catch {
      toast.error('Failed to deactivate location')
    }
  }

  async function handleReactivate() {
    try {
      await updateMutation.mutateAsync({ locationId: locationId!, isActive: true })
      router.push('/locations')
    } catch {
      toast.error('Failed to reactivate location')
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync({ locationId: locationId! })
      router.push('/locations')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Reassign all staff and ensure no bookings reference this location before deleting.')
      } else {
        toast.error('Failed to delete location')
      }
    } finally {
      setDeleteOpen(false)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!isNew && isLoading) return <LoadingState />

  const defaultValues = location
    ? { name: location.name, address: location.address ?? '', timezone: location.timezone }
    : undefined

  return (
    <PageShell>
      <PageHeader title={isNew ? 'New location' : (location?.name ?? 'Location')} />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationForm
            defaultValues={defaultValues}
            onSubmit={handleSave}
            isPending={isPending}
            formError={formError}
          />
        </CardContent>
      </Card>

      {!isNew && location && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent>
              {location.isActive ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeactivateOpen(true)}
                  disabled={updateMutation.isPending}
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
            </CardContent>
          </Card>

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
                Delete location
              </Button>
            </CardContent>
          </Card>

          <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deactivate {location.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This location will no longer appear in the active list.
                  You can reactivate it at any time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDeactivate}>
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {location.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the location.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </PageShell>
  )
}
