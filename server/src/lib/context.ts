import { Request } from 'express';
import { ApiError } from './errors';

export type StaffRole = 'admin' | 'reception' | 'therapist';

export interface AuthedContext {
  uid: string;
  email: string;
  tenantId: string;
  role: StaffRole;
  ip: string;
}

/** Every route in this app is tenant-scoped — this is the single place that enforces that. */
export function requireTenantAuth(req: Request, allowedRoles?: StaffRole[]): AuthedContext {
  const authInfo = req.auth;
  if (!authInfo) {
    throw new ApiError('unauthenticated', 'Bu işlem için giriş yapmanız gerekiyor.');
  }

  const tenantId = authInfo.token['tenantId'] as string | undefined;
  const role = authInfo.token['role'] as StaffRole | undefined;
  if (!tenantId || !role) {
    throw new ApiError('failed-precondition', 'Kullanıcının bir işletmeye (tenant) atanmış rolü yok.');
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new ApiError('permission-denied', 'Bu işlem için yetkiniz yok.');
  }

  return {
    uid: authInfo.uid,
    email: (authInfo.token['email'] as string) ?? '',
    tenantId,
    role,
    ip: getClientIp(req),
  };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? 'unknown';
}
