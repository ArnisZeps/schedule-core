import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { AuthProvider } from '../../providers/AuthProvider'
import { UnauthenticatedOnly } from '@/components/UnauthenticatedOnly'
import { TEST_TOKEN } from './handlers'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => '/'),
}))

let mockReplace: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockReplace = vi.fn()
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), replace: mockReplace, back: vi.fn() } as any)
})

function renderGate(hasToken: boolean) {
  if (hasToken) localStorage.setItem('sc_token', TEST_TOKEN)
  render(
    <AuthProvider>
      <UnauthenticatedOnly redirectTo="/services">
        <p>public content</p>
      </UnauthenticatedOnly>
    </AuthProvider>,
  )
}

describe('UnauthenticatedOnly', () => {
  it('renders children and does not redirect when there is no valid token', async () => {
    renderGate(false)

    await waitFor(() => {
      expect(screen.getByText('public content')).toBeInTheDocument()
    })

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('renders nothing and redirects to the given route when a valid token is present', async () => {
    renderGate(true)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/services')
    })

    expect(screen.queryByText('public content')).not.toBeInTheDocument()
  })
})
