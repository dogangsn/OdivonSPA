import { NextFunction, Request, Response } from 'express';
import { auth } from '../lib/admin';

/**
 * Verifies a Bearer Firebase ID token when present and sets req.auth. Deliberately does NOT
 * reject requests with no/invalid token here — requireTenantAuth (lib/context.ts) is the single
 * place that turns "no auth" into a 401, exactly like the old callables' `request.auth` check.
 */
export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    req.auth = { uid: decoded.uid, token: decoded };
  } catch {
    // Invalid/expired token — leave req.auth unset, requireTenantAuth will reject as unauthenticated.
  }
  next();
}
