import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from './useAuth'

export interface ServiceSlot {
  startAt: string
  endAt: string
  available: boolean
}

export function useServiceSlots(serviceId: string, date: string | null) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<ServiceSlot[]>({
    queryKey: ['serviceSlots', tenantId, serviceId, date],
    queryFn: () =>
      apiFetch<ServiceSlot[]>(`/tenants/${tenantId}/services/${serviceId}/slots?date=${date}`),
    enabled: !!date && !!serviceId,
  })
}
