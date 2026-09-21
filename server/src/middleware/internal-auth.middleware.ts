import { timingSafeEqual } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

/** Guards /internal/* routes (system jobs with no Firebase caller) with a shared secret header. */
export function internalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.CRON_SECRET;
  const provided = req.header('X-Cron-Secret');

  if (!expected || !provided || !timingSafeEqualStrings(provided, expected)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
