import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, ApiError } from '@/lib/api'
import { useAuth } from './useAuth'

export interface Booking {
  id: string
  tenantId: string
  resourceId: string
  clientName: string
  clientEmail: string
  startAt: string
  endAt: string
  status: 'pending' | 'confirmed' | 'cancelled'
  createdAt: string
}

export function useBookings(params: { from: string; to: string; resourceId?: string }) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  const { from, to, resourceId } = params
  const search = new URLSearchParams({ from, to })
  if (resourceId) search.set('resourceId', resourceId)
  return useQuery<Booking[]>({
    queryKey: ['bookings', tenantId, { from, to, resourceId }],
    queryFn: () => apiFetch(`/tenants/${tenantId}/bookings?${search}`),
  })
}

export function useUpcomingBookings(params: { resourceId?: string } = {}) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  const { resourceId } = params
  const from = new Date().toISOString()
  const search = new URLSearchParams({ from })
  if (resourceId) search.set('resourceId', resourceId)
  return useQuery<Booking[]>({
    queryKey: ['bookings', tenantId, 'upcoming', { resourceId }],
    queryFn: () => apiFetch(`/tenants/${tenantId}/bookings?${search}`),
  })
}

export function useCancelBooking() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation<Booking, ApiError, string>({
    mutationFn: (bookingId: string) =>
      apiFetch<Booking>(`/tenants/${tenantId}/bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  })
}

export function useRescheduleBooking() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation<Booking, ApiError, { id: string; startAt: string; endAt: string }>({
    mutationFn: ({ id, startAt, endAt }) =>
      apiFetch<Booking>(`/tenants/${tenantId}/bookings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ startAt, endAt }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  })
}
