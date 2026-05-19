'use client'

import { createContext } from 'react'

export interface User {
  userId: string
  tenantId: string
}

export interface AuthContextValue {
  user: User | null
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
