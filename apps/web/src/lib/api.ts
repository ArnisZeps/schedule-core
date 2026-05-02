const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('sc_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    if (res.status === 401) {
      localStorage.removeItem('sc_token')
      window.location.replace('/login')
    }
    throw new ApiError(res.status, body.message ?? res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
