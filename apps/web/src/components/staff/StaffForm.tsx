import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string(),
  phone: z.string(),
})

export type StaffFormValues = z.infer<typeof schema>

interface StaffFormProps {
  defaultValues?: Partial<StaffFormValues>
  onSubmit: (values: StaffFormValues) => Promise<void>
  isPending?: boolean
  onCancel?: () => void
}

export function StaffForm({ defaultValues, onSubmit, isPending, onCancel }: StaffFormProps) {
  const form = useForm<StaffFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', ...defaultValues },
  })

  useEffect(() => {
    if (defaultValues) form.reset({ name: '', email: '', phone: '', ...defaultValues })
  }, [defaultValues?.name, defaultValues?.email, defaultValues?.phone]) // eslint-disable-line

  async function handleValidateAndSubmit(values: StaffFormValues) {
    if (values.email && !EMAIL_RE.test(values.email)) {
      form.setError('email', { message: 'Invalid email' })
      return
    }
    await onSubmit(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleValidateAndSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Alice Smith" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="alice@example.com"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="+1 555 000 0001"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  )
}
