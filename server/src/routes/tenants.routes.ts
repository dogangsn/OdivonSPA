import { Router } from 'express';
import { FieldValue, db } from '../lib/admin';
import { writeAuditLog } from '../lib/audit';
import { getClientIp } from '../lib/context';
import { ApiError, asyncHandler } from '../lib/errors';
import { resolveMembership, setMembershipClaims } from '../lib/membership';

export const tenantsRouter = Router();

interface CreateTenantBody {
  businessName?: string;
  ownerName?: string;
}

/** Restores an access claim only when the verified caller has one unambiguous active staff record. */
tenantsRouter.post(
  '/membership/resolve',
  asyncHandler(async (req, res) => {
    const callerAuth = req.auth;
    if (!callerAuth) throw new ApiError('unauthenticated', 'Bu işlem için giriş yapmanız gerekiyor.');

    const result = await resolveMembership(callerAuth.uid, callerAuth.token);
    if (result.status === 'ambiguous') {
      throw new ApiError('failed-precondition', 'Bu e-posta birden fazla işletmeyle eşleşiyor. Lütfen destek ekibiyle iletişime geçin.');
    }
    res.json(result);
  }),
);

/** Onboarding entry point: the caller must already exist as a Firebase Auth user with no tenant claim yet. */
tenantsRouter.post(
  '/tenants',
  asyncHandler(async (req, res) => {
    const callerAuth = req.auth;
    if (!callerAuth) {
      throw new ApiError('unauthenticated', 'Bu işlem için giriş yapmanız gerekiyor.');
    }
    const membership = await resolveMembership(callerAuth.uid, callerAuth.token);
    if (membership.status === 'claimed') {
      throw new ApiError('failed-precondition', 'Bu kullanıcı zaten bir işletmeye bağlı.');
    }
    if (membership.status === 'restored') {
      res.json({ tenantId: membership.tenantId, restored: true });
      return;
    }
    if (membership.status === 'ambiguous') {
      throw new ApiError('failed-precondition', 'Bu e-posta birden fazla işletmeyle eşleşiyor. Yeni işletme kaydı oluşturulamadı; lütfen destek ekibiyle iletişime geçin.');
    }

    const body = req.body as CreateTenantBody;
    const businessName = body?.businessName?.trim();
    const ownerName = body?.ownerName?.trim();
    if (!businessName || !ownerName) {
      throw new ApiError('invalid-argument', 'İşletme adı ve ad soyad zorunludur.');
    }

    const tenantRef = db.collection('tenants').doc();
    await tenantRef.set({
      name: businessName,
      plan: 'trial',
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      settings: { timezone: 'Europe/Istanbul', currency: 'TRY', workDayStart: '09:00', workDayEnd: '21:00' },
    });

    await tenantRef.collection('staff').doc(callerAuth.uid).set({
      ad: ownerName,
      email: callerAuth.token['email'] ?? '',
      emailNormalized: typeof callerAuth.token['email'] === 'string' ? callerAuth.token['email'].trim().toLowerCase() : '',
      role: 'admin',
      uzmanliklar: [],
      primOraniVarsayilan: 0,
      renk: '#6366f1',
      active: true,
    });

    await setMembershipClaims(callerAuth.uid, { tenantId: tenantRef.id, role: 'admin' });

    await writeAuditLog({
      tenantId: tenantRef.id,
      entity: 'tenants',
      action: 'callable',
      entityId: tenantRef.id,
      after: { name: businessName },
      actor: { uid: callerAuth.uid, email: (callerAuth.token['email'] as string) ?? '', ip: getClientIp(req) },
    });

    res.json({ tenantId: tenantRef.id });
  }),
);
