const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: 'include' })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    if (res.status === 401 && window.location.pathname !== '/login') {
      window.location.replace('/login')
    }
    throw new ApiError(res.status, body.message ?? res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
