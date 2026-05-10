'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { useLocations } from '@/hooks/useLocations'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'

export function LocationListPage() {
  const [includeInactive, setIncludeInactive] = useState(false)
  const { data: locations, isLoading } = useLocations(includeInactive)
  const router = useRouter()

  return (
    <PageShell>
      <PageHeader
        title="Locations"
        action={
          <Button asChild>
            <Link href="/locations/new">New location</Link>
          </Button>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <Checkbox
          id="show-inactive"
          aria-label="Show inactive"
          checked={includeInactive}
          onCheckedChange={checked => setIncludeInactive(!!checked)}
        />
        <Label htmlFor="show-inactive">Show deactivated</Label>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : !locations?.length ? (
        <EmptyState
          icon={<MapPin className="size-10" />}
          title="No locations yet"
          description="Add your first location to get started."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map(loc => (
                <TableRow
                  key={loc.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/locations/${loc.id}`)}
                >
                  <TableCell className="font-medium">{loc.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {loc.address ?? '—'}
                  </TableCell>
                  <TableCell>
                    {!loc.isActive && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageShell>
  )
}
