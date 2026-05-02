import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useAuth } from './useAuth'

export interface Resource {
  id: string
  tenantId: string
  name: string
  description?: string
}

export function useResources() {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<Resource[]>({
    queryKey: ['resources', tenantId],
    queryFn: () => apiFetch(`/tenants/${tenantId}/resources`),
  })
}

export function useCreateResource() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiFetch<Resource>(`/tenants/${tenantId}/resources`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources', tenantId] }),
  })
}

export function useUpdateResource(resourceId: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiFetch<Resource>(`/tenants/${tenantId}/resources/${resourceId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources', tenantId] })
      qc.invalidateQueries({ queryKey: ['resource', tenantId, resourceId] })
    },
  })
}

export function useDeleteResource() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (resourceId: string) =>
      apiFetch(`/tenants/${tenantId}/resources/${resourceId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources', tenantId] }),
  })
}
