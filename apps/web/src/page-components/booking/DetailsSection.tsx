'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Label } from '@/components/ui/label'
import type { PublicSlot } from '@/hooks/usePublicBooking'

const schema = z.object({
  clientName: z.string().min(1, 'Required'),
  clientPhone: z.string().min(7, 'Minimum 7 characters'),
  clientEmail: z.string().email('Invalid email').or(z.literal('')).optional(),
})

export type DetailsFormValues = z.infer<typeof schema>

const inputCls =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 md:text-sm'

interface Props {
  selectedSlot: PublicSlot | null
  isSubmitting: boolean
  submitError: string | null
  onSubmit: (values: DetailsFormValues) => void
}

export function DetailsSection({ selectedSlot, isSubmitting, submitError, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DetailsFormValues>({ resolver: zodResolver(schema) })

  return (
    <section id="section-details" className="space-y-3">
      <h2 className="text-lg font-semibold">Your Details</h2>
      <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="clientName">Name</Label>
          <input id="clientName" className={inputCls} placeholder="Jane Doe" {...register('clientName')} />
          {errors.clientName && (
            <p className="text-sm text-destructive">{errors.clientName.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="clientPhone">Phone</Label>
          <input
            id="clientPhone"
            type="tel"
            className={inputCls}
            placeholder="+1 555 000 0000"
            {...register('clientPhone')}
          />
          {errors.clientPhone && (
            <p className="text-sm text-destructive">{errors.clientPhone.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="clientEmail">
            Email <span className="text-muted-foreground">(optional)</span>
          </Label>
          <input
            id="clientEmail"
            type="email"
            className={inputCls}
            placeholder="jane@example.com"
            {...register('clientEmail')}
          />
          {errors.clientEmail && (
            <p className="text-sm text-destructive">{errors.clientEmail.message}</p>
          )}
        </div>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <button
          type="submit"
          disabled={!selectedSlot || isSubmitting}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Confirming…' : 'Confirm booking'}
        </button>
      </form>
    </section>
  )
}
