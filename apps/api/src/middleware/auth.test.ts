import { vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './auth.js';

const SECRET = 'a'.repeat(32);

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

function makeReq(authHeader?: string): Request {
  return { headers: { authorization: authHeader } } as unknown as Request;
}

function makeRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('authMiddleware', () => {
  it('calls next() and attaches req.auth for a valid token', async () => {
    const token = jwt.sign({ sub: 'user-1', tenantId: 'tenant-1' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: '7d',
    });
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect((req as any).auth).toEqual({ userId: 'user-1', tenantId: 'tenant-1' });
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is expired', async () => {
    const token = jwt.sign({ sub: 'user-1', tenantId: 'tenant-1' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: -1,
    });
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a malformed token', async () => {
    const req = makeReq('Bearer not.a.jwt');
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Bearer prefix is missing', async () => {
    const token = jwt.sign({ sub: 'user-1', tenantId: 'tenant-1' }, SECRET, {
      algorithm: 'HS256',
    });
    const req = makeReq(token);
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });
});
