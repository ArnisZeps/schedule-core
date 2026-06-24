'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { ApiError } from '@/lib/api'
import { useUpdateEmail, useUpdatePassword, useDeleteAccount } from '@/hooks/useAccount'
import { useUpdateTenant } from '@/hooks/useTenant'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'

interface SettingsPageProps {
  email: string
  tenant: { name: string; slug: string }
}

function SuccessNote({ children }: { children: React.ReactNode }) {
  return <p role="status" className="text-sm text-emerald-600">{children}</p>
}

const emailSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

function EmailSection({ email }: { email: string }) {
  const [done, setDone] = useState(false)
  const mutation = useUpdateEmail()
  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email },
  })

  async function onSubmit(values: z.infer<typeof emailSchema>) {
    setDone(false)
    try {
      await mutation.mutateAsync(values.email)
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        form.setError('email', { message: 'Email already in use' })
      } else {
        form.setError('root', { message: 'Could not update email. Please try again.' })
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} onChange={(e) => { setDone(false); field.onChange(e) }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root && (
          <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
        )}
        {done && <SuccessNote>Email updated</SuccessNote>}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save email'}
        </Button>
      </form>
    </Form>
  )
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

function PasswordSection() {
  const [done, setDone] = useState(false)
  const mutation = useUpdatePassword()
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })

  async function onSubmit(values: z.infer<typeof passwordSchema>) {
    setDone(false)
    try {
      await mutation.mutateAsync(values)
      form.reset({ currentPassword: '', newPassword: '' })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        form.setError('currentPassword', { message: 'Current password is incorrect' })
      } else {
        form.setError('root', { message: 'Could not update password. Please try again.' })
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root && (
          <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
        )}
        {done && <SuccessNote>Password updated</SuccessNote>}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </Form>
  )
}

const businessSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  slug: z.string().regex(/^[a-z0-9-]{3,50}$/, 'Use 3–50 lowercase letters, numbers, or hyphens'),
})

function BusinessSection({ tenant }: { tenant: { name: string; slug: string } }) {
  const [done, setDone] = useState(false)
  const mutation = useUpdateTenant()
  const form = useForm<z.infer<typeof businessSchema>>({
    resolver: zodResolver(businessSchema),
    defaultValues: { name: tenant.name, slug: tenant.slug },
  })

  async function onSubmit(values: z.infer<typeof businessSchema>) {
    setDone(false)
    try {
      await mutation.mutateAsync(values)
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        form.setError('slug', { message: 'This URL is already taken' })
      } else {
        form.setError('root', { message: 'Could not update business details. Please try again.' })
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business name</FormLabel>
              <FormControl>
                <Input {...field} onChange={(e) => { setDone(false); field.onChange(e) }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input {...field} onChange={(e) => { setDone(false); field.onChange(e) }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root && (
          <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
        )}
        {done && <SuccessNote>Business details updated</SuccessNote>}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save business'}
        </Button>
      </form>
    </Form>
  )
}

function DangerSection() {
  const router = useRouter()
  const mutation = useDeleteAccount()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onConfirm() {
    setError(null)
    try {
      await mutation.mutateAsync(password)
      router.replace('/login')
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Incorrect password')
      } else {
        setError('Could not delete account. Please try again.')
      }
    }
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all of its data, including bookings. This cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => { setPassword(''); setError(null); setOpen(true) }}>
          Delete account
        </Button>
      </CardContent>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your business, bookings, and all related data. Enter your password to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-password">Password</Label>
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setError(null); setPassword(e.target.value) }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={mutation.isPending || password.length === 0}
            >
              {mutation.isPending ? 'Deleting…' : 'Delete account'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

export function SettingsPage({ email, tenant }: SettingsPageProps) {
  return (
    <PageShell className="max-w-lg">
      <PageHeader title="Settings" subtitle="Manage your account and business details." />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <EmailSection email={email} />
            <PasswordSection />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business</CardTitle>
          </CardHeader>
          <CardContent>
            <BusinessSection tenant={tenant} />
          </CardContent>
        </Card>

        <DangerSection />
      </div>
    </PageShell>
  )
}
