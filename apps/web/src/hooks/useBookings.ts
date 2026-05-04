import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, ApiError } from '@/lib/api'
import { useAuth } from './useAuth'

export interface Booking {
  id: string
  tenantId: string
  serviceId: string
  clientName: string
  clientPhone: string
  clientEmail: string | null
  startAt: string
  endAt: string
  status: 'pending' | 'confirmed' | 'cancelled'
  notes: string | null
  createdAt: string
}

export function useBookings(params: { from: string; to: string; serviceId?: string }) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  const { from, to, serviceId } = params
  const search = new URLSearchParams({ from, to })
  if (serviceId) search.set('serviceId', serviceId)
  return useQuery<Booking[]>({
    queryKey: ['bookings', tenantId, { from, to, serviceId }],
    queryFn: () => apiFetch(`/tenants/${tenantId}/bookings?${search}`),
  })
}

export function useUpcomingBookings(params: { serviceId?: string } = {}) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  const { serviceId } = params
  const from = new Date().toISOString()
  const search = new URLSearchParams({ from })
  if (serviceId) search.set('serviceId', serviceId)
  return useQuery<Booking[]>({
    queryKey: ['bookings', tenantId, 'upcoming', { serviceId }],
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
