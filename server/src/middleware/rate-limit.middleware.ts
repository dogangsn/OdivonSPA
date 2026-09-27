import { Request } from 'express';
import rateLimit from 'express-rate-limit';

/** Signed-in callers are limited per user (shared office IPs stay usable); anonymous ones per IP. */
function keyByUserOrIp(req: Request): string {
  return req.auth?.uid ? `uid:${req.auth.uid}` : `ip:${req.ip ?? 'unknown'}`;
}

const common = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  // `trust proxy` is on for Render; the key is the uid for every authenticated route anyway.
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { code: 'resource-exhausted', message: 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.' },
};

/** General ceiling for the whole API — well above what a busy front desk generates. */
export const apiRateLimit = rateLimit({ ...common, windowMs: 60 * 1000, limit: 300 });

/** Account-creating endpoints (tenant onboarding, staff invites) — cheap to abuse, rarely used legitimately. */
export const sensitiveRateLimit = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 20 });
