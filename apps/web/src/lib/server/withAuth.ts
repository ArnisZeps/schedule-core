import { verifyToken } from './jwt';

export interface AuthPayload {
  userId: string;
  tenantId: string;
}

export function withAuth(request: Request): AuthPayload | null {
  const cookieHeader = request.headers.get('cookie');
  const match = cookieHeader?.match(/(?:^|;)\s*sc_token=([^;]+)/);
  const token = match?.[1]?.trim();
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    return { userId: payload.sub, tenantId: payload.tenantId };
  } catch {
    return null;
  }
}
