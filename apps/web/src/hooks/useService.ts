import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from './useAuth'
import type { Service } from './useServices'

export function useService(serviceId: string) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<Service>({
    queryKey: ['service', tenantId, serviceId],
    queryFn: () => apiFetch(`/tenants/${tenantId}/services/${serviceId}`),
    enabled: !!serviceId,
  })
}
