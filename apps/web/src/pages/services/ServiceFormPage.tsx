import { useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { toast } from 'sonner'
import { useService } from '@/hooks/useService'
import { useCreateService, useUpdateService } from '@/hooks/useServices'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
})

type FormValues = z.infer<typeof schema>

export function ServiceFormPage() {
  const { serviceId } = useParams()
  const isEdit = !!serviceId
  const navigate = useNavigate()

  const { data: service } = useService(serviceId ?? '')
  const createMutation = useCreateService()
  const updateMutation = useUpdateService(serviceId ?? '')

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  useEffect(() => {
    if (service) {
      form.reset({ name: service.name, description: service.description ?? '' })
    }
  }, [service, form])

  const isPending = createMutation.isPending || updateMutation.isPending

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values)
      } else {
        await createMutation.mutateAsync(values)
      }
      toast.success(isEdit ? 'Service updated' : 'Service created')
      navigate('/services')
    } catch {
      toast.error('Failed to save service')
    }
  }

  return (
    <PageShell className="max-w-lg">
      <PageHeader title={isEdit ? 'Edit Service' : 'New Service'} />
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Haircut" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional description" rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/services')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      {isEdit && (
        <div className="mt-4">
          <Link
            to={`/services/${serviceId}/availability`}
            className="text-sm text-primary hover:underline"
          >
            Manage availability
          </Link>
        </div>
      )}
    </PageShell>
  )
}
