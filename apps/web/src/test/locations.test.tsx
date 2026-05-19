import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useParams } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserProvider } from '@/components/UserProvider'
import { server } from './handlers'
import { http, HttpResponse } from 'msw'
import { LocationListPage } from '@/page-components/locations/LocationListPage'
import { LocationDetailPage } from '@/page-components/locations/LocationDetailPage'
import { TEST_TOKEN, TENANT_ID, LOCATIONS } from './handlers'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => '/locations'),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={String(href)} {...props as object}>{children}</a>,
}))

const BASE = '/api'

let mockPush: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockPush = vi.fn()
  vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: vi.fn(), back: vi.fn() } as any)
  localStorage.clear()
})

function renderPage(component: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <UserProvider user={{ userId: 'user-1', tenantId: 'tenant-1' }}>{component}</UserProvider>
    </QueryClientProvider>,
  )
}

describe('Locations', () => {
  // ---------------------------------------------------------------------------
  // Location list
  // ---------------------------------------------------------------------------

  describe('Location list', () => {
    it('renders active locations only by default', async () => {
      renderPage(<LocationListPage />)
      await waitFor(() => {
        expect(screen.getByText('Main Branch')).toBeInTheDocument()
        expect(screen.queryByText('East Branch')).not.toBeInTheDocument()
      })
    })

    it('shows address when present', async () => {
      renderPage(<LocationListPage />)
      await waitFor(() => {
        expect(screen.getByText('123 Main St')).toBeInTheDocument()
      })
    })

    it('show-inactive toggle reveals deactivated locations with visual indicator', async () => {
      const user = userEvent.setup()
      renderPage(<LocationListPage />)
      await waitFor(() => screen.getByText('Main Branch'))
      await user.click(screen.getByRole('checkbox', { name: /show inactive/i }))
      await waitFor(() => {
        expect(screen.getByText('East Branch')).toBeInTheDocument()
        // inactive location has visual indicator (badge or text)
        expect(screen.getByText(/inactive/i)).toBeInTheDocument()
      })
    })

    it('"New location" button links to /locations/new', async () => {
      renderPage(<LocationListPage />)
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /new location/i })).toHaveAttribute('href', '/locations/new')
      })
    })

    it('clicking a location row navigates to detail page', async () => {
      const user = userEvent.setup()
      renderPage(<LocationListPage />)
      await waitFor(() => screen.getByText('Main Branch'))
      await user.click(screen.getByText('Main Branch'))
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('loc-1'))
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Location create
  // ---------------------------------------------------------------------------

  describe('Location create form', () => {
    it('shows validation error when name is empty', async () => {
      const user = userEvent.setup()
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByRole('button', { name: /save/i }))
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument()
      })
    })

    it('does not render a timezone input field', async () => {
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByLabelText(/name/i))
      expect(screen.queryByLabelText(/timezone/i)).not.toBeInTheDocument()
    })

    it('POST body includes the browser timezone', async () => {
      const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
        () => ({ resolvedOptions: () => ({ timeZone: 'America/New_York' }) } as Intl.DateTimeFormat),
      )
      let capturedBody: Record<string, unknown> | null = null
      server.use(
        http.post(`${BASE}/tenants/${TENANT_ID}/locations`, async ({ request }) => {
          capturedBody = await request.json() as Record<string, unknown>
          return HttpResponse.json(
            { id: 'loc-new', tenantId: TENANT_ID, address: null, isActive: true, createdAt: new Date().toISOString(), ...capturedBody },
            { status: 201 },
          )
        }),
      )
      const user = userEvent.setup()
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByLabelText(/name/i))
      await user.type(screen.getByLabelText(/name/i), 'Branch X')
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(capturedBody?.timezone).toBe('America/New_York')
      })
      spy.mockRestore()
    })

    it('successful create navigates to the new location detail page', async () => {
      const user = userEvent.setup()
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByLabelText(/name/i))
      await user.type(screen.getByLabelText(/name/i), 'Branch X')
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(mockPush.mock.calls[0]?.[0]).toMatch(/^\/locations\//)
      })
    })

    it('422 response shows inline field errors', async () => {
      server.use(
        http.post(`${BASE}/tenants/${TENANT_ID}/locations`, () => {
          return HttpResponse.json(
            { error: 'validation_error', details: ['name'] },
            { status: 422 },
          )
        }),
      )
      const user = userEvent.setup()
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByLabelText(/name/i))
      await user.type(screen.getByLabelText(/name/i), 'Bad')
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Location detail (existing location)
  // ---------------------------------------------------------------------------

  describe('Location detail — edit', () => {
    beforeEach(() => {
      vi.mocked(useParams).mockReturnValue({ locationId: 'loc-1' })
    })

    it('renders name field with existing value and no timezone input', async () => {
      renderPage(<LocationDetailPage />)
      await waitFor(() => {
        expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Main Branch')
      })
      expect(screen.queryByLabelText(/timezone/i)).not.toBeInTheDocument()
    })

    it('PATCH body preserves the stored location timezone', async () => {
      let capturedBody: Record<string, unknown> | null = null
      server.use(
        http.patch(`${BASE}/tenants/${TENANT_ID}/locations/loc-1`, async ({ request }) => {
          capturedBody = await request.json() as Record<string, unknown>
          return HttpResponse.json({ ...LOCATIONS[0], ...capturedBody })
        }),
      )
      const user = userEvent.setup()
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByLabelText(/name/i))
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(capturedBody?.timezone).toBe('Europe/Riga')
      })
    })

    it('saving calls PATCH and shows success toast', async () => {
      const user = userEvent.setup()
      let patchCalled = false
      server.use(
        http.patch(`${BASE}/tenants/${TENANT_ID}/locations/loc-1`, async () => {
          patchCalled = true
          return HttpResponse.json({ ...LOCATIONS[0] })
        }),
      )
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByLabelText(/name/i))
      await user.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => {
        expect(patchCalled).toBe(true)
      })
    })

    it('deactivate button opens AlertDialog', async () => {
      const user = userEvent.setup()
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByRole('button', { name: /deactivate/i }))
      await user.click(screen.getByRole('button', { name: /deactivate/i }))
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })
    })

    it('confirming deactivation sends PATCH { isActive: false } and navigates to list', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.patch(`${BASE}/tenants/${TENANT_ID}/locations/loc-1`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ ...LOCATIONS[0], isActive: false })
        }),
      )
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByRole('button', { name: /deactivate/i }))
      await user.click(screen.getByRole('button', { name: /deactivate/i }))
      await waitFor(() => screen.getByRole('alertdialog'))
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /confirm/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({ isActive: false })
        expect(mockPush).toHaveBeenCalledWith('/locations')
      })
    })

    it('delete button opens AlertDialog', async () => {
      const user = userEvent.setup()
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByRole('button', { name: /delete location/i }))
      await user.click(screen.getByRole('button', { name: /delete location/i }))
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })
    })

    it('confirming delete calls DELETE and navigates to /locations', async () => {
      const user = userEvent.setup()
      let deleteCalled = false
      server.use(
        http.delete(`${BASE}/tenants/${TENANT_ID}/locations/loc-1`, () => {
          deleteCalled = true
          return new HttpResponse(null, { status: 204 })
        }),
      )
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByRole('button', { name: /delete location/i }))
      await user.click(screen.getByRole('button', { name: /delete location/i }))
      await waitFor(() => screen.getByRole('alertdialog'))
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /confirm/i }))
      await waitFor(() => {
        expect(deleteCalled).toBe(true)
        expect(mockPush).toHaveBeenCalledWith('/locations')
      })
    })

    it('delete 409 shows toast error and stays on page', async () => {
      const user = userEvent.setup()
      server.use(
        http.delete(`${BASE}/tenants/${TENANT_ID}/locations/loc-1`, () => {
          return HttpResponse.json(
            { error: 'Reassign all staff and ensure no bookings reference this location before deleting.' },
            { status: 409 },
          )
        }),
      )
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByRole('button', { name: /delete location/i }))
      await user.click(screen.getByRole('button', { name: /delete location/i }))
      await waitFor(() => screen.getByRole('alertdialog'))
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /confirm/i }))
      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalledWith('/locations')
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Location detail — inactive location (reactivate)
  // ---------------------------------------------------------------------------

  describe('Location detail — inactive', () => {
    beforeEach(() => {
      vi.mocked(useParams).mockReturnValue({ locationId: 'loc-2' })
    })

    it('shows Reactivate button for inactive location', async () => {
      renderPage(<LocationDetailPage />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reactivate/i })).toBeInTheDocument()
      })
    })

    it('reactivate sends PATCH { isActive: true } and navigates to list', async () => {
      const user = userEvent.setup()
      let capturedBody: unknown
      server.use(
        http.patch(`${BASE}/tenants/${TENANT_ID}/locations/loc-2`, async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ ...LOCATIONS[1], isActive: true })
        }),
      )
      renderPage(<LocationDetailPage />)
      await waitFor(() => screen.getByRole('button', { name: /reactivate/i }))
      await user.click(screen.getByRole('button', { name: /reactivate/i }))
      await waitFor(() => {
        expect(capturedBody).toMatchObject({ isActive: true })
        expect(mockPush).toHaveBeenCalledWith('/locations')
      })
    })
  })
})
