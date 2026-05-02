import { useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { toast } from 'sonner'
import { useResource } from '../../hooks/useResource'
import { useCreateResource, useUpdateResource } from '../../hooks/useResources'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '../../components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../components/ui/form'
import { PageShell } from '../../components/layout/PageShell'
import { PageHeader } from '../../components/layout/PageHeader'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
})

type FormValues = z.infer<typeof schema>

export function ResourceFormPage() {
  const { resourceId } = useParams()
  const isEdit = !!resourceId
  const navigate = useNavigate()

  const { data: resource } = useResource(resourceId ?? '')
  const createMutation = useCreateResource()
  const updateMutation = useUpdateResource(resourceId ?? '')

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  useEffect(() => {
    if (resource) {
      form.reset({ name: resource.name, description: resource.description ?? '' })
    }
  }, [resource, form])

  const isPending = createMutation.isPending || updateMutation.isPending

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values)
      } else {
        await createMutation.mutateAsync(values)
      }
      toast.success(isEdit ? 'Resource updated' : 'Resource created')
      navigate('/resources')
    } catch {
      toast.error('Failed to save resource')
    }
  }

  return (
    <PageShell className="max-w-lg">
      <PageHeader title={isEdit ? 'Edit Resource' : 'New Resource'} />
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
                      <Input placeholder="e.g. Chair 1" {...field} />
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
                  onClick={() => navigate('/resources')}
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
            to={`/resources/${resourceId}/availability`}
            className="text-sm text-primary hover:underline"
          >
            Manage availability
          </Link>
        </div>
      )}
    </PageShell>
  )
}
