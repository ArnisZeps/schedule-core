import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, ApiError } from '@/lib/api'
import { useAuth } from './useAuth'

export interface Location {
  id: string
  tenantId: string
  name: string
  address: string | null
  timezone: string
  isActive: boolean
  createdAt: string
}

export interface CreateLocationInput {
  name: string
  address?: string
  timezone: string
}

export interface UpdateLocationInput {
  name?: string
  address?: string | null
  timezone?: string
  isActive?: boolean
}

export function useLocations(includeInactive?: boolean) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<Location[]>({
    queryKey: ['locations', tenantId, { includeInactive: !!includeInactive }],
    queryFn: () => {
      const qs = includeInactive ? '?includeInactive=true' : ''
      return apiFetch(`/tenants/${tenantId}/locations${qs}`)
    },
  })
}

export function useLocation(locationId: string) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<Location>({
    queryKey: ['locations', tenantId, locationId],
    queryFn: () => apiFetch(`/tenants/${tenantId}/locations/${locationId}`),
    enabled: !!locationId,
  })
}

export function useCreateLocation() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation<Location, ApiError, CreateLocationInput>({
    mutationFn: (data) =>
      apiFetch<Location>(`/tenants/${tenantId}/locations`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations', tenantId] }),
  })
}

export function useUpdateLocation() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation<Location, ApiError, { locationId: string } & UpdateLocationInput>({
    mutationFn: ({ locationId, ...data }) =>
      apiFetch<Location>(`/tenants/${tenantId}/locations/${locationId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { locationId }) => {
      qc.invalidateQueries({ queryKey: ['locations', tenantId] })
      qc.invalidateQueries({ queryKey: ['locations', tenantId, locationId] })
    },
  })
}

export function useDeleteLocation() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation<void, ApiError, { locationId: string }>({
    mutationFn: ({ locationId }) =>
      apiFetch(`/tenants/${tenantId}/locations/${locationId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations', tenantId] }),
  })
}
