import { verifyToken } from './jwt';

export interface AuthPayload {
  userId: string;
  tenantId: string;
}

export function withAuth(request: Request): AuthPayload | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const token = header.slice(7);
    const payload = verifyToken(token);
    return { userId: payload.sub, tenantId: payload.tenantId };
  } catch {
    return null;
  }
}
