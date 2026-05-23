'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query'
import { useStaffList } from '@/hooks/useStaff'
import { useLocations } from '@/hooks/useLocations'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'

export function StaffListPage({ dehydratedState }: { dehydratedState?: DehydratedState } = {}) {
  return (
    <HydrationBoundary state={dehydratedState}>
      <StaffListPageInner />
    </HydrationBoundary>
  )
}

function StaffListPageInner() {
  const [includeInactive, setIncludeInactive] = useState(false)
  const [locationFilter, setLocationFilter] = useState('')
  const { data: locations = [] } = useLocations()
  const activeLocations = locations.filter(l => l.isActive)
  const showLocationFilter = activeLocations.length > 1
  const { data: staff, isLoading } = useStaffList(includeInactive, locationFilter || undefined)

  return (
    <PageShell>
      <PageHeader
        title="Staff"
        action={
          <Button asChild>
            <Link href="/staff/new">Add staff</Link>
          </Button>
        }
      />

      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-inactive"
            checked={includeInactive}
            onCheckedChange={checked => setIncludeInactive(!!checked)}
          />
          <Label htmlFor="show-inactive">Show inactive</Label>
        </div>
        {showLocationFilter && (
          <div className="flex items-center gap-2">
            <label htmlFor="location-filter" className="text-sm font-medium">Filter by location</label>
            <select
              id="location-filter"
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">All locations</option>
              {activeLocations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : !staff?.length ? (
        <EmptyState
          icon={<Users className="size-10" />}
          title="No staff yet"
          description="Add your first staff member to get started."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link href={`/staff/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.email ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? 'default' : 'secondary'}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </Badge>
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
