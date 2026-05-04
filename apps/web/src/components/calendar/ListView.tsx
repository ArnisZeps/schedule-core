import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CalendarDays } from 'lucide-react'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { useUpcomingBookings, type Booking } from '@/hooks/useBookings'
import type { Service } from '@/hooks/useServices'

const STATUS_BADGE: Record<Booking['status'], 'default' | 'secondary' | 'outline'> = {
  pending: 'outline',
  confirmed: 'default',
  cancelled: 'secondary',
}

const STATUS_LABEL: Record<Booking['status'], string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}

interface ListViewProps {
  serviceId?: string
  services: Service[]
  onBookingClick: (booking: Booking) => void
}

export function ListView({ serviceId, services, onBookingClick }: ListViewProps) {
  const { data: bookings, isLoading, isError, refetch } = useUpcomingBookings({ serviceId })

  console.log(bookings)
  
  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState message="Failed to load appointments" onRetry={refetch} />

  if (!bookings?.length) {
    return <EmptyState icon={<CalendarDays className="size-8" />} title="No upcoming appointments" />
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map(booking => {
            const start = new Date(booking.startAt)
            const end = new Date(booking.endAt)
            const service = services.find(s => s.id === booking.serviceId)
            return (
              <TableRow
                key={booking.id}
                className="cursor-pointer"
                onClick={() => onBookingClick(booking)}
              >
                <TableCell>{format(start, 'MMM d, yyyy')}</TableCell>
                <TableCell>
                  {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                </TableCell>
                <TableCell>{booking.clientName}</TableCell>
                <TableCell>{service?.name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[booking.status]}>
                    {STATUS_LABEL[booking.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
