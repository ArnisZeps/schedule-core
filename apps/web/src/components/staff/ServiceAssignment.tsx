import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useServices } from '@/hooks/useServices'
import { useStaffServices, useUpdateStaffServices } from '@/hooks/useStaff'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/ui/LoadingState'

interface ServiceAssignmentProps {
  staffId: string
}

export function ServiceAssignment({ staffId }: ServiceAssignmentProps) {
  const { data: allServices, isLoading: servicesLoading } = useServices()
  const { data: assignedServices, isLoading: assignedLoading } = useStaffServices(staffId)
  const updateMutation = useUpdateStaffServices()

  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (assignedServices) {
      setSelected(new Set(assignedServices.map(s => s.id)))
    }
  }, [assignedServices])

  async function handleSave() {
    try {
      await updateMutation.mutateAsync({ staffId, serviceIds: Array.from(selected) })
      toast.success('Services updated')
    } catch {
      toast.error('Failed to update services')
    }
  }

  if (servicesLoading || assignedLoading) return <LoadingState />

  return (
    <div className="space-y-3">
      {allServices?.map(service => (
        <div key={service.id} className="flex items-center gap-2">
          <Checkbox
            id={`svc-${service.id}`}
            checked={selected.has(service.id)}
            onCheckedChange={checked => {
              const next = new Set(selected)
              if (checked) next.add(service.id)
              else next.delete(service.id)
              setSelected(next)
            }}
          />
          <Label htmlFor={`svc-${service.id}`}>{service.name}</Label>
        </div>
      ))}
      <Button
        size="sm"
        onClick={handleSave}
        disabled={updateMutation.isPending}
      >
        {updateMutation.isPending ? 'Saving…' : 'Save services'}
      </Button>
    </div>
  )
}
