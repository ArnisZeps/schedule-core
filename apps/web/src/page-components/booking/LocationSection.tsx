'use client'

import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PublicLocation } from '@/hooks/usePublicBooking'

interface Props {
  locations: PublicLocation[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function LocationSection({ locations, selectedId, onSelect }: Props) {
  return (
    <section id="section-location" className="space-y-3">
      <h2 className="text-lg font-semibold">Location</h2>
      {locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No locations available.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => onSelect(loc.id)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-accent',
                selectedId === loc.id && 'border-primary bg-accent',
              )}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <div className="font-medium">{loc.name}</div>
                {loc.address && (
                  <div className="text-sm text-muted-foreground">{loc.address}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
