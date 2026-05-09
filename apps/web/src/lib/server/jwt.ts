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
  return jwt.sign(payload, assertJwtSecret(), { expiresIn: '7d', algorithm: 'HS256' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, assertJwtSecret(), { algorithms: ['HS256'] }) as TokenPayload;
}
