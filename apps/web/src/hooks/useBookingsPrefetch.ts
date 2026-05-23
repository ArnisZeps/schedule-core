import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { parseISO, addDays } from 'date-fns'
import { apiFetch } from '@/lib/api'
import { useAuth } from './useAuth'

export function useBookingsPrefetch(params: {
  view: 'week' | 'day' | 'list'
  from: string
  to: string
  serviceId?: string
}) {
  const { view, from, to, serviceId } = params
  const { user } = useAuth()
  const tenantId = user!.tenantId
  const qc = useQueryClient()

  useEffect(() => {
    if (view === 'list') return

    const d = parseISO(from)
    const periods =
      view === 'week'
        ? [
            { from: addDays(d, -7).toISOString(), to: d.toISOString() },
            { from: addDays(d, 7).toISOString(), to: addDays(d, 14).toISOString() },
          ]
        : [
            { from: addDays(d, -1).toISOString(), to: d.toISOString() },
            { from: addDays(d, 1).toISOString(), to: addDays(d, 2).toISOString() },
          ]
    
    for (const period of periods) {
      const search = new URLSearchParams({ from: period.from, to: period.to })
      if (serviceId) search.set('serviceId', serviceId)
      console.log('[prefetch] starting', period.from.slice(0, 10), '→', period.to.slice(0, 10))
      qc.prefetchQuery({
        queryKey: ['bookings', tenantId, { from: period.from, to: period.to, serviceId }],
        queryFn: () => {
          console.log('[prefetch] fetching', period.from.slice(0, 10), '→', period.to.slice(0, 10))
          return apiFetch(`/tenants/${tenantId}/bookings?${search}`).then(data => {
            console.log('[prefetch] done', period.from.slice(0, 10), '→', period.to.slice(0, 10), `(${(data as unknown[]).length} bookings)`)
            return data
          })
        },
        staleTime: 30_000,
      })
    }
  }, [view, from, to, serviceId, tenantId, qc])
}
