import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, ApiError } from '@/lib/api'
import { useAuth } from './useAuth'
import type { Booking } from './useBookings'

export interface CreateBookingInput {
  serviceId: string
  clientName: string
  clientPhone: string
  clientEmail?: string
  startAt: string
  endAt: string
  notes?: string
  override?: boolean
}

export function useCreateBooking() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation<Booking, ApiError, CreateBookingInput>({
    mutationFn: (input) =>
      apiFetch<Booking>(`/tenants/${tenantId}/bookings`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  })
}
