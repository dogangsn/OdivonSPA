import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

export type StaffRole = 'admin' | 'reception' | 'therapist';

export interface AuthedContext {
  uid: string;
  email: string;
  tenantId: string;
  role: StaffRole;
  ip: string;
}

/** Every callable in this app is tenant-scoped — this is the single place that enforces that. */
export function requireTenantAuth(request: CallableRequest, allowedRoles?: StaffRole[]): AuthedContext {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Bu işlem için giriş yapmanız gerekiyor.');
  }

  const tenantId = auth.token['tenantId'] as string | undefined;
  const role = auth.token['role'] as StaffRole | undefined;
  if (!tenantId || !role) {
    throw new HttpsError('failed-precondition', 'Kullanıcının bir işletmeye (tenant) atanmış rolü yok.');
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
  }

  return {
    uid: auth.uid,
    email: (auth.token['email'] as string) ?? '',
    tenantId,
    role,
    ip: getClientIp(request),
  };
}

function getClientIp(request: CallableRequest): string {
  const forwarded = request.rawRequest?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return request.rawRequest?.ip ?? 'unknown';
}
