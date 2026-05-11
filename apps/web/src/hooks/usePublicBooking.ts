import { useQuery, useMutation } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'

export interface PublicLocation {
  id: string
  name: string
  address: string | null
  timezone: string
}

export interface PublicService {
  id: string
  name: string
  description: string | null
  durationMinutes: number
}

export interface PublicStaffMember {
  id: string
  name: string
}

export interface PublicSlot {
  startAt: string
  endAt: string
  available: boolean
}

export interface CreatePublicBookingInput {
  serviceId: string
  locationId: string
  staffId: string | null
  clientName: string
  clientPhone: string
  clientEmail?: string
  startAt: string
  endAt: string
}

export interface PublicBookingResult {
  id: string
  serviceId: string
  serviceName: string
  staffId: string | null
  staffName: string | null
  locationId: string
  locationName: string
  clientName: string
  clientPhone: string
  clientEmail: string | null
  startAt: string
  endAt: string
  status: string
  createdAt: string
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api'

async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, body.message ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export function usePublicLocations(tenantSlug: string) {
  return useQuery<PublicLocation[]>({
    queryKey: ['publicLocations', tenantSlug],
    queryFn: () => publicFetch<PublicLocation[]>(`/public/${tenantSlug}/locations`),
  })
}

export function usePublicServices(tenantSlug: string) {
  return useQuery<PublicService[]>({
    queryKey: ['publicServices', tenantSlug],
    queryFn: () => publicFetch<PublicService[]>(`/public/${tenantSlug}/services`),
  })
}

export function usePublicStaff(
  tenantSlug: string,
  serviceId: string | null,
  locationId: string | null,
) {
  return useQuery<PublicStaffMember[]>({
    queryKey: ['publicStaff', tenantSlug, serviceId, locationId],
    queryFn: () =>
      publicFetch<PublicStaffMember[]>(
        `/public/${tenantSlug}/services/${serviceId}/staff?locationId=${locationId}`,
      ),
    enabled: serviceId != null && locationId != null,
  })
}

export function usePublicSlots(
  tenantSlug: string,
  serviceId: string | null,
  locationId: string | null,
  staffId: string | null,
  date: string | null,
) {
  return useQuery<PublicSlot[]>({
    queryKey: ['publicSlots', tenantSlug, serviceId, locationId, staffId, date],
    queryFn: () => {
      const params = new URLSearchParams({ date: date!, locationId: locationId! })
      if (staffId) params.set('staffId', staffId)
      return publicFetch<PublicSlot[]>(
        `/public/${tenantSlug}/services/${serviceId}/slots?${params}`,
      )
    },
    enabled: serviceId != null && locationId != null && date != null,
  })
}

export function useCreatePublicBooking(tenantSlug: string) {
  return useMutation<PublicBookingResult, ApiError, CreatePublicBookingInput>({
    mutationFn: (input) =>
      publicFetch<PublicBookingResult>(`/public/${tenantSlug}/bookings`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  })
}
