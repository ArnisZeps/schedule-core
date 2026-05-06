import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from './useAuth'
import type { Service } from './useServices'

export interface Staff {
  id: string
  tenantId: string
  name: string
  email: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
}

export interface ScheduleWindow {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface ScheduleWindowInput {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface ScheduleOverride {
  id: string
  staffId: string
  startDate: string
  endDate: string
  type: 'available' | 'not_available'
  startTime: string
  endTime: string
  createdAt: string
}

export interface OverrideInput {
  startDate: string
  endDate: string
  type: 'available' | 'not_available'
  startTime: string
  endTime: string
}

export function useStaffList(includeInactive?: boolean) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<Staff[]>({
    queryKey: ['staff', tenantId, { includeInactive: !!includeInactive }],
    queryFn: () => {
      const qs = includeInactive ? '?includeInactive=true' : ''
      return apiFetch(`/tenants/${tenantId}/staff${qs}`)
    },
  })
}

export function useStaff(staffId: string) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<Staff>({
    queryKey: ['staff', tenantId, staffId],
    queryFn: () => apiFetch(`/tenants/${tenantId}/staff/${staffId}`),
    enabled: !!staffId,
  })
}

export function useCreateStaff() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (data: { name: string; email?: string | null; phone?: string | null }) =>
      apiFetch<Staff>(`/tenants/${tenantId}/staff`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', tenantId] }),
  })
}

export function useUpdateStaff() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: ({
      staffId,
      ...data
    }: {
      staffId: string
      name?: string
      email?: string | null
      phone?: string | null
      isActive?: boolean
    }) =>
      apiFetch<Staff>(`/tenants/${tenantId}/staff/${staffId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { staffId }) => {
      qc.invalidateQueries({ queryKey: ['staff', tenantId] })
      qc.invalidateQueries({ queryKey: ['staff', tenantId, staffId] })
    },
  })
}

export function useStaffServices(staffId: string) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<Service[]>({
    queryKey: ['staff-services', tenantId, staffId],
    queryFn: () => apiFetch(`/tenants/${tenantId}/staff/${staffId}/services`),
    enabled: !!staffId,
  })
}

export function useUpdateStaffServices() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: ({ staffId, serviceIds }: { staffId: string; serviceIds: string[] }) =>
      apiFetch<Service[]>(`/tenants/${tenantId}/staff/${staffId}/services`, {
        method: 'PUT',
        body: JSON.stringify({ serviceIds }),
      }),
    onSuccess: (_, { staffId }) => {
      qc.invalidateQueries({ queryKey: ['staff-services', tenantId, staffId] })
    },
  })
}

export function useStaffSchedules(staffId: string) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<ScheduleWindow[]>({
    queryKey: ['staff-schedules', tenantId, staffId],
    queryFn: () => apiFetch(`/tenants/${tenantId}/staff/${staffId}/schedules`),
    enabled: !!staffId,
  })
}

export function useUpdateStaffSchedules() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: ({ staffId, windows }: { staffId: string; windows: ScheduleWindowInput[] }) =>
      apiFetch<ScheduleWindow[]>(`/tenants/${tenantId}/staff/${staffId}/schedules`, {
        method: 'PUT',
        body: JSON.stringify({ windows }),
      }),
    onSuccess: (_, { staffId }) => {
      qc.invalidateQueries({ queryKey: ['staff-schedules', tenantId, staffId] })
    },
  })
}

export function useStaffOverrides(staffId: string, from?: string, to?: string) {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useQuery<ScheduleOverride[]>({
    queryKey: ['staff-overrides', tenantId, staffId, from, to],
    queryFn: () => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString() ? `?${params}` : ''
      return apiFetch(`/tenants/${tenantId}/staff/${staffId}/overrides${qs}`)
    },
    enabled: !!staffId,
  })
}

export function useCreateStaffOverride() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: ({ staffId, ...data }: { staffId: string } & OverrideInput) =>
      apiFetch<ScheduleOverride>(`/tenants/${tenantId}/staff/${staffId}/overrides`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { staffId }) => {
      qc.invalidateQueries({ queryKey: ['staff-overrides', tenantId, staffId] })
    },
  })
}

export function useUpdateStaffOverride() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: ({
      staffId,
      overrideId,
      ...data
    }: { staffId: string; overrideId: string } & OverrideInput) =>
      apiFetch<ScheduleOverride>(
        `/tenants/${tenantId}/staff/${staffId}/overrides/${overrideId}`,
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
    onSuccess: (_, { staffId }) => {
      qc.invalidateQueries({ queryKey: ['staff-overrides', tenantId, staffId] })
    },
  })
}

export function useDeleteStaffOverride() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: ({ staffId, overrideId }: { staffId: string; overrideId: string }) =>
      apiFetch(`/tenants/${tenantId}/staff/${staffId}/overrides/${overrideId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, { staffId }) => {
      qc.invalidateQueries({ queryKey: ['staff-overrides', tenantId, staffId] })
    },
  })
}
