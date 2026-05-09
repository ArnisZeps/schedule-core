import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useStaffList } from '@/hooks/useStaff'
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

export function StaffListPage() {
  const [includeInactive, setIncludeInactive] = useState(false)
  const { data: staff, isLoading } = useStaffList(includeInactive)

  return (
    <PageShell>
      <PageHeader
        title="Staff"
        action={
          <Button asChild>
            <Link to="/staff/new">Add staff</Link>
          </Button>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <Checkbox
          id="show-inactive"
          checked={includeInactive}
          onCheckedChange={checked => setIncludeInactive(!!checked)}
        />
        <Label htmlFor="show-inactive">Show inactive</Label>
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
                    <Link to={`/staff/${s.id}`} className="hover:underline">
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
