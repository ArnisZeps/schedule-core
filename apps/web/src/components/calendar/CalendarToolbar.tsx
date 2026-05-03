import { useSearchParams } from 'react-router-dom'
import { addDays, subDays, parseISO, format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Resource } from '@/hooks/useResources'

interface CalendarToolbarProps {
  resources: Resource[]
}

export function CalendarToolbar({ resources }: CalendarToolbarProps) {
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') || 'week') as 'week' | 'day' | 'list'
  const dateStr = params.get('date') || format(new Date(), 'yyyy-MM-dd')
  const resourceId = params.get('resourceId') || undefined

  function setParam(key: string, value: string | null) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (value === null) next.delete(key)
      else next.set(key, value)
      return next
    })
  }

  function navigate(direction: 'prev' | 'next' | 'today') {
    if (direction === 'today') {
      setParam('date', format(new Date(), 'yyyy-MM-dd'))
      return
    }
    const current = parseISO(dateStr)
    const days = view === 'day' ? 1 : 7
    const next = direction === 'next' ? addDays(current, days) : subDays(current, days)
    setParam('date', format(next, 'yyyy-MM-dd'))
  }

  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b bg-background flex-shrink-0">
      <Button variant="outline" size="sm" onClick={() => navigate('today')}>
        Today
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => navigate('prev')}
        aria-label="Prev"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => navigate('next')}
        aria-label="Next"
      >
        <ChevronRight className="size-4" />
      </Button>

      <div className="flex-1" />

      {/* View toggle */}
      <div className="flex border rounded-md overflow-hidden">
        {(['week', 'day', 'list'] as const).map(v => (
          <Button
            key={v}
            variant={view === v ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-none"
            onClick={() => setParam('view', v)}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </Button>
        ))}
      </div>

      {/* Resource filter */}
      <Select
        value={resourceId ?? 'all'}
        onValueChange={val => setParam('resourceId', val === 'all' ? null : val)}
      >
        <SelectTrigger className="w-44" aria-label="Resource">
          <SelectValue placeholder="All resources" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All resources</SelectItem>
          {resources.map(r => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
