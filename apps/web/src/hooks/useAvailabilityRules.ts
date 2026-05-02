import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useAuth } from './useAuth'

export interface AvailabilityRule {
  id: string
  resourceId: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export function useAvailabilityRules(resourceId: string) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<AvailabilityRule[]>({
    queryKey: ['availability', tenantId, resourceId],
    queryFn: () => apiFetch(`/tenants/${tenantId}/resources/${resourceId}/availability-rules`),
    enabled: !!resourceId,
  })
}

export function useCreateAvailabilityRule(resourceId: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (data: { dayOfWeek: number; startTime: string; endTime: string }) =>
      apiFetch<AvailabilityRule>(
        `/tenants/${tenantId}/resources/${resourceId}/availability-rules`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability', tenantId, resourceId] }),
  })
}

export function useDeleteAvailabilityRule(resourceId: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (ruleId: string) =>
      apiFetch(
        `/tenants/${tenantId}/resources/${resourceId}/availability-rules/${ruleId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability', tenantId, resourceId] }),
  })
}
