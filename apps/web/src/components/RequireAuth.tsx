import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user || user.exp <= Date.now() / 1000) {
    return <Navigate to="/login" state={{ next: location.pathname }} replace />
  }

  return <>{children}</>
}
