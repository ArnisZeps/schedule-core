import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt.js';

export interface AuthPayload {
  userId: string;
  tenantId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = verifyToken(token);
    req.auth = { userId: payload.sub, tenantId: payload.tenantId };
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}
