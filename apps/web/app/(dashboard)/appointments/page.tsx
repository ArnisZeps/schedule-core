'use client'

import { Suspense } from 'react'
import { AppointmentsPage } from '@/page-components/appointments/AppointmentsPage'

export default function Page() {
  return (
    <Suspense>
      <AppointmentsPage />
    </Suspense>
  )
}
