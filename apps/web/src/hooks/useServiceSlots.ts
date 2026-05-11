import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from './useAuth'

export interface ServiceSlot {
  startAt: string
  endAt: string
  available: boolean
}

export function useServiceSlots(
  serviceId: string,
  date: string | null,
  staffId: string | null,
  locationId: string | null,
) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  const enabled = !!date && !!serviceId && (!!staffId || !!locationId)
  return useQuery<ServiceSlot[]>({
    queryKey: ['serviceSlots', tenantId, serviceId, date, staffId, locationId],
    queryFn: () => {
      const params = new URLSearchParams({ date: date! })
      if (staffId) params.set('staffId', staffId)
      else if (locationId) params.set('locationId', locationId)
      return apiFetch<ServiceSlot[]>(`/tenants/${tenantId}/services/${serviceId}/slots?${params}`)
    },
    enabled,
  })
}
