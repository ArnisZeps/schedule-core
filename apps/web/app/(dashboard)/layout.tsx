'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/AppLayout'
import { decodeToken } from '@/context/AuthContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('sc_token')
    if (!token || !decodeToken(token)) {
      router.replace('/login')
    } else {
      setAuthenticated(true)
    }
  }, [router])

  if (!authenticated) return null

  return <AppLayout>{children}</AppLayout>
}
