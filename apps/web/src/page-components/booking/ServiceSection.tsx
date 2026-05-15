'use client'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { PublicService } from '@/hooks/usePublicBooking'

interface Props {
  services: PublicService[]
  isLoading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ServiceSection({ services, isLoading, selectedId, onSelect }: Props) {
  if (isLoading) {
    return (
      <section id="section-service" className="space-y-3">
        <h2 className="text-lg font-semibold">Service</h2>
        <div data-testid="service-skeleton" className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </section>
    )
  }

  return (
    <section id="section-service" className="space-y-3">
      <h2 className="text-lg font-semibold">Service</h2>
      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services available.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((svc) => (
            <button
              key={svc.id}
              data-selected={selectedId === svc.id ? '' : undefined}
              onClick={() => onSelect(svc.id)}
              className={cn(
                'rounded-xl border p-4 text-left transition-colors hover:bg-accent',
                selectedId === svc.id && 'border-primary bg-accent',
              )}
            >
              <div className="font-medium">{svc.name}</div>
              {svc.description && (
                <div className="mt-1 text-sm text-muted-foreground">{svc.description}</div>
              )}
              <div className="mt-2 text-xs text-muted-foreground">{svc.durationMinutes} min</div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
