'use client'

import { cn } from '@/lib/utils'
import type { PublicStaffMember } from '@/hooks/usePublicBooking'

interface Props {
  staff: PublicStaffMember[]
  isLoading: boolean
  selectedId: string | 'any' | null
  onSelect: (id: string | 'any') => void
  prerequisiteMet: boolean
}

export function StaffSection({ staff, isLoading, selectedId, onSelect, prerequisiteMet }: Props) {
  return (
    <section id="section-staff" className="space-y-3">
      <h2 className="text-lg font-semibold">Staff</h2>
      {!prerequisiteMet ? (
        <p className="text-sm text-muted-foreground">Select a service first.</p>
      ) : isLoading ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => onSelect('any')}
            className={cn(
              'rounded-xl border p-4 text-left transition-colors hover:bg-accent',
              selectedId === 'any' && 'border-primary bg-accent',
            )}
          >
            <div className="font-medium">Any available</div>
            <div className="mt-1 text-sm text-muted-foreground">
              First available staff will be assigned
            </div>
          </button>
          {staff.map((member) => (
            <button
              key={member.id}
              onClick={() => onSelect(member.id)}
              className={cn(
                'rounded-xl border p-4 text-left transition-colors hover:bg-accent',
                selectedId === member.id && 'border-primary bg-accent',
              )}
            >
              <div className="font-medium">{member.name}</div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
