import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { auth, db, FieldValue } from '../lib/admin';
import { writeAuditLog } from '../lib/audit';

interface CreateTenantData {
  businessName: string;
  ownerName: string;
}

/** Onboarding entry point: the caller must already exist as a Firebase Auth user with no tenant claim yet. */
export const createTenant = onCall<CreateTenantData>({ region: 'europe-west1' }, async (request) => {
  const callerAuth = request.auth;
  if (!callerAuth) {
    throw new HttpsError('unauthenticated', 'Bu işlem için giriş yapmanız gerekiyor.');
  }
  if (callerAuth.token['tenantId']) {
    throw new HttpsError('failed-precondition', 'Bu kullanıcı zaten bir işletmeye bağlı.');
  }

  const businessName = request.data?.businessName?.trim();
  const ownerName = request.data?.ownerName?.trim();
  if (!businessName || !ownerName) {
    throw new HttpsError('invalid-argument', 'İşletme adı ve ad soyad zorunludur.');
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
    role: 'admin',
    uzmanliklar: [],
    primOraniVarsayilan: 0,
    renk: '#6366f1',
    active: true,
  });

  await auth.setCustomUserClaims(callerAuth.uid, { tenantId: tenantRef.id, role: 'admin' });

  await writeAuditLog({
    tenantId: tenantRef.id,
    entity: 'tenants',
    action: 'callable',
    entityId: tenantRef.id,
    after: { name: businessName },
    actor: { uid: callerAuth.uid, email: (callerAuth.token['email'] as string) ?? '', ip: request.rawRequest?.ip ?? 'unknown' },
  });

  return { tenantId: tenantRef.id };
});
