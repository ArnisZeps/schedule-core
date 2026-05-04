import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from './useAuth'

export interface Service {
  id: string
  tenantId: string
  name: string
  description?: string
  durationMinutes: number
}

export function useServices() {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<Service[]>({
    queryKey: ['services', tenantId],
    queryFn: () => apiFetch(`/tenants/${tenantId}/services`),
  })
}

export function useCreateService() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (data: { name: string; description?: string; durationMinutes?: number }) =>
      apiFetch<Service>(`/tenants/${tenantId}/services`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services', tenantId] }),
  })
}

export function useUpdateService(serviceId: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (data: { name: string; description?: string; durationMinutes?: number }) =>
      apiFetch<Service>(`/tenants/${tenantId}/services/${serviceId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services', tenantId] })
      qc.invalidateQueries({ queryKey: ['service', tenantId, serviceId] })
    },
  })
}

export function useDeleteService() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (serviceId: string) =>
      apiFetch(`/tenants/${tenantId}/services/${serviceId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services', tenantId] }),
  })
}
