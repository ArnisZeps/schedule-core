'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export function UnauthenticatedOnly({ children, redirectTo }: { children: React.ReactNode; redirectTo: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => { setHydrated(true) }, [])

  useEffect(() => {
    if (hydrated && user) router.replace(redirectTo)
  }, [hydrated, user, router, redirectTo])

  if (!hydrated || user) return null
  return <>{children}</>
}
