import jwt from 'jsonwebtoken';

export interface TokenPayload {
  sub: string;
  tenantId: string;
  iat?: number;
  exp?: number;
}

export function assertJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set — refusing to start');
  }
  return secret;
}

export function signToken(payload: Pick<TokenPayload, 'sub' | 'tenantId'>): string {
  const expiresIn = (process.env.JWT_EXPIRY ?? '30d') as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, assertJwtSecret(), { expiresIn, algorithm: 'HS256' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, assertJwtSecret(), { algorithms: ['HS256'] }) as TokenPayload;
}

export function getTokenMaxAge(): number {
  const expiry = process.env.JWT_EXPIRY ?? '30d'
  if (/^\d+$/.test(expiry)) return parseInt(expiry, 10)
  const unit = expiry.slice(-1)
  const value = parseInt(expiry.slice(0, -1), 10)
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
  return value * (multipliers[unit] ?? 86400)
}
