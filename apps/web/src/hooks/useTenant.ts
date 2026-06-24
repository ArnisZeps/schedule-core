import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from './useAuth'

export interface Tenant {
  id: string
  name: string
  slug: string
  createdAt: string
}

export function useUpdateTenant() {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (data: { name?: string; slug?: string }) =>
      apiFetch<Tenant>(`/tenants/${tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  })
}
