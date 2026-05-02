import { createContext, useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const TOKEN_KEY = 'sc_token'
const EMAIL_KEY = 'sc_email'

interface JwtPayload {
  sub: string
  tenantId: string
  exp: number
}

export interface User {
  userId: string
  tenantId: string
  exp: number
  email?: string
}

export interface AuthContextValue {
  user: User | null
  login: (token: string, email?: string) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function decodeToken(token: string): Omit<User, 'email'> | null {
  try {
    const payload: JwtPayload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp <= Date.now() / 1000) return null
    return { userId: payload.sub, tenantId: payload.tenantId, exp: payload.exp }
  } catch {
    return null
  }
}

function readUser(): User | null {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null
  const decoded = decodeToken(token)
  if (!decoded) return null
  const email = localStorage.getItem(EMAIL_KEY) ?? undefined
  return { ...decoded, email }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(readUser)

  const login = useCallback((token: string, email?: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    if (email) localStorage.setItem(EMAIL_KEY, email)
    const decoded = decodeToken(token)
    if (decoded) setUser({ ...decoded, email })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EMAIL_KEY)
    setUser(null)
    navigate('/login')
  }, [navigate])

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
