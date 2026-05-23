import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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

    const dFrom = new Date(from)
    const dTo = new Date(to)

    const periods = [
      { from: new Date(dFrom.getTime() - (dTo.getTime() - dFrom.getTime())).toISOString(), to: from },
      { from: to, to: new Date(dTo.getTime() + (dTo.getTime() - dFrom.getTime())).toISOString() },
    ]

    for (const period of periods) {
      const search = new URLSearchParams({ from: period.from, to: period.to })
      if (serviceId) search.set('serviceId', serviceId)
      qc.prefetchQuery({
        queryKey: ['bookings', tenantId, { from: period.from, to: period.to, serviceId }],
        queryFn: () => apiFetch(`/tenants/${tenantId}/bookings?${search}`),
        staleTime: 30_000,
      })
    }
  }, [view, from, to, serviceId, tenantId, qc])
}
