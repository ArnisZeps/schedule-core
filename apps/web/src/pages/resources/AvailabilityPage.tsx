import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useAvailabilityRules,
  useCreateAvailabilityRule,
  useDeleteAvailabilityRule,
} from '../../hooks/useAvailabilityRules'
import { ApiError } from '../../lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '../../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { Separator } from '../../components/ui/separator'
import { PageShell } from '../../components/layout/PageShell'
import { PageHeader } from '../../components/layout/PageHeader'
import { LoadingState } from '../../components/ui/LoadingState'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function AvailabilityPage() {
  const { resourceId } = useParams<{ resourceId: string }>()
  const { data: rules, isLoading } = useAvailabilityRules(resourceId!)
  const createMutation = useCreateAvailabilityRule(resourceId!)
  const deleteMutation = useDeleteAvailabilityRule(resourceId!)

  const [day, setDay] = useState('1')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [formError, setFormError] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (startTime >= endTime) {
      setFormError('End time must be after start time')
      return
    }
    try {
      await createMutation.mutateAsync({
        dayOfWeek: Number(day),
        startTime,
        endTime,
      })
      toast.success('Availability window added')
      setStartTime('')
      setEndTime('')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to add window'
      setFormError(msg)
    }
  }

  async function handleDelete(ruleId: string) {
    try {
      await deleteMutation.mutateAsync(ruleId)
      toast.success('Window removed')
    } catch {
      toast.error('Failed to remove window')
    }
  }

  return (
    <PageShell>
      <div className="mb-2">
        <Link
          to={`/resources/${resourceId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to resource
        </Link>
      </div>
      <PageHeader
        title="Availability"
        subtitle="Set weekly recurring availability windows."
      />

      {isLoading ? (
        <LoadingState />
      ) : (
        <div className="rounded-lg border bg-card max-w-2xl">
          {rules && rules.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map(rule => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{DAYS[rule.dayOfWeek]}</TableCell>
                    <TableCell>{rule.startTime}</TableCell>
                    <TableCell>{rule.endTime}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(rule.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">
              No availability windows set.
            </p>
          )}
        </div>
      )}

      <Separator className="my-6 max-w-2xl" />

      <form onSubmit={handleAdd} className="flex flex-wrap gap-4 items-end max-w-2xl">
        <div className="grid gap-1.5">
          <Label htmlFor="day-select">Day</Label>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger id="day-select" className="w-36" aria-label="Day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d, i) => (
                <SelectItem key={i} value={String(i)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="start-time">Start time</Label>
          <Input
            id="start-time"
            type="time"
            aria-label="Start time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            required
            className="w-32"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="end-time">End time</Label>
          <Input
            id="end-time"
            type="time"
            aria-label="End time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            required
            className="w-32"
          />
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          Add window
        </Button>
      </form>
      {formError && (
        <p className="text-sm text-destructive mt-2">{formError}</p>
      )}
    </PageShell>
  )
}
