'use client'

import { MapPin, Tag, User, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavSection {
  id: string
  label: string
}

const ICONS: Record<string, React.ReactNode> = {
  'section-location': <MapPin className="size-4" />,
  'section-service': <Tag className="size-4" />,
  'section-staff': <User className="size-4" />,
  'section-datetime': <Clock className="size-4" />,
}

interface Props {
  sections: NavSection[]
  activeSection: string | null
}

export function FloatingNav({ sections, activeSection }: Props) {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      aria-label="Booking sections"
      className="fixed right-3 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-2 md:hidden"
    >
      {sections.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => scrollTo(id)}
          aria-label={label}
          className={cn(
            'flex size-10 items-center justify-center rounded-full border bg-background/50 backdrop-blur-sm transition-colors',
            activeSection === id && 'border-primary bg-background/90',
          )}
        >
          {ICONS[id]}
        </button>
      ))}
    </nav>
  )
}
