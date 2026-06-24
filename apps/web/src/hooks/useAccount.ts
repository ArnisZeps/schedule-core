import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from './useAuth'

export function useUpdateEmail() {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<{ email: string }>(`/account/email`, {
        method: 'PATCH',
        body: JSON.stringify({ email }),
      }),
  })
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiFetch<void>(`/account/password`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  })
}

export function useDeleteAccount() {
  const { user } = useAuth()
  const tenantId = user!.tenantId
  return useMutation({
    mutationFn: (password: string) =>
      apiFetch<void>(`/tenants/${tenantId}`, {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      }),
  })
}
