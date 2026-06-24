import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const AUTH_PAGES = new Set(['/', '/login', '/register'])

async function resolveUser(token: string | undefined) {
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    const userId = payload.sub
    const tenantId = (payload as Record<string, unknown>).tenantId as string | undefined
    if (!userId || !tenantId) return null
    return { userId, tenantId }
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('sc_token')?.value
  const user = await resolveUser(token)

  if (AUTH_PAGES.has(pathname)) {
    if (user) return NextResponse.redirect(new URL('/services', request.url))
    return NextResponse.next()
  }

  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', user.userId)
  requestHeaders.set('x-tenant-id', user.tenantId)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    '/(services|locations|staff|appointments|settings)(.*)',
    '/',
    '/login',
    '/register',
  ],
}
