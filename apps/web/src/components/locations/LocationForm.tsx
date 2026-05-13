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

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string(),
  timezone: z.string(),
})

export type LocationFormValues = z.infer<typeof schema>

interface LocationFormProps {
  defaultValues?: Partial<LocationFormValues>
  onSubmit: (values: LocationFormValues) => Promise<void>
  isPending?: boolean
  formError?: string
}

export function LocationForm({ defaultValues, onSubmit, isPending, formError }: LocationFormProps) {
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', address: '', timezone: browserTimezone, ...defaultValues },
  })

  useEffect(() => {
    if (defaultValues) form.reset({ name: '', address: '', timezone: browserTimezone, ...defaultValues })
  }, [defaultValues?.name, defaultValues?.timezone, defaultValues?.address]) // eslint-disable-line

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Main Branch" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {formError && (
          <p className="text-sm text-destructive" data-testid="form-error">{formError}</p>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Form>
  )
}
