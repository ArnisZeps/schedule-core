import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from './useAuth'

export interface AvailabilityRule {
  id: string
  serviceId: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export function useAvailabilityRules(serviceId: string) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<AvailabilityRule[]>({
    queryKey: ['availability', tenantId, serviceId],
    queryFn: () => apiFetch(`/tenants/${tenantId}/services/${serviceId}/availability-rules`),
    enabled: !!serviceId,
  })
}

export function useCreateAvailabilityRule(serviceId: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (data: { dayOfWeek: number; startTime: string; endTime: string }) =>
      apiFetch<AvailabilityRule>(
        `/tenants/${tenantId}/services/${serviceId}/availability-rules`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability', tenantId, serviceId] }),
  })
}

export function useDeleteAvailabilityRule(serviceId: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (ruleId: string) =>
      apiFetch(
        `/tenants/${tenantId}/services/${serviceId}/availability-rules/${ruleId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability', tenantId, serviceId] }),
  })
}
