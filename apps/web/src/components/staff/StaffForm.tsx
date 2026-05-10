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
import { useLocations } from '@/hooks/useLocations'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string(),
  phone: z.string(),
  locationId: z.string(),
})

export type StaffFormValues = z.infer<typeof schema>

interface StaffFormProps {
  defaultValues?: Partial<StaffFormValues>
  onSubmit: (values: StaffFormValues) => Promise<void>
  isPending?: boolean
  onCancel?: () => void
  forceShowLocation?: boolean
}

export function StaffForm({ defaultValues, onSubmit, isPending, onCancel, forceShowLocation }: StaffFormProps) {
  const { data: locations = [] } = useLocations()
  const activeLocations = locations.filter(l => l.isActive)
  const showLocationPicker = forceShowLocation || activeLocations.length > 1

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', locationId: '', ...defaultValues },
  })

  useEffect(() => {
    if (defaultValues) form.reset({ name: '', email: '', phone: '', locationId: '', ...defaultValues })
  }, [defaultValues?.name, defaultValues?.email, defaultValues?.phone, defaultValues?.locationId]) // eslint-disable-line

  useEffect(() => {
    if (!showLocationPicker && activeLocations.length === 1) {
      form.setValue('locationId', activeLocations[0].id)
    }
  }, [showLocationPicker, activeLocations.length]) // eslint-disable-line

  async function handleValidateAndSubmit(values: StaffFormValues) {
    if (values.email && !EMAIL_RE.test(values.email)) {
      form.setError('email', { message: 'Invalid email' })
      return
    }
    if (showLocationPicker && !values.locationId) {
      form.setError('locationId', { message: 'Location is required' })
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
        {showLocationPicker && (
          <FormField
            control={form.control}
            name="locationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    value={field.value ?? ''}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">Select location</option>
                    {activeLocations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
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
