import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { useAuth } from './useAuth'
import type { Resource } from './useResources'

export function useResource(resourceId: string) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<Resource>({
    queryKey: ['resource', tenantId, resourceId],
    queryFn: () => apiFetch(`/tenants/${tenantId}/resources/${resourceId}`),
    enabled: !!resourceId,
  })
}
