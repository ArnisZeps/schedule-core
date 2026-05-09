import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '../providers/AuthProvider'
import { QueryProvider } from '../providers/QueryProvider'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'ScheduleCore',
  description: 'Appointment scheduling for your business',
  openGraph: {
    title: 'ScheduleCore',
    description: 'Appointment scheduling for your business',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
