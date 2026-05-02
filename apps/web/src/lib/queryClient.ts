import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { ApiError } from './api'

function handle401(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    localStorage.removeItem('sc_token')
    window.location.replace('/login')
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handle401 }),
  mutationCache: new MutationCache({ onError: handle401 }),
  defaultOptions: { queries: { retry: false } },
})
