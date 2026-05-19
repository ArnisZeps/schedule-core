'use client'

import { useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AuthContext } from '@/context/AuthContext'
import type { AuthContextValue } from '@/context/AuthContext'

interface Props {
  user: { userId: string; tenantId: string }
  children: React.ReactNode
}

export function UserProvider({ user, children }: Props) {
  const router = useRouter()

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
  }, [router])

  const value: AuthContextValue = useMemo(
    () => ({ user: { userId: user.userId, tenantId: user.tenantId }, logout }),
    [user.userId, user.tenantId, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
