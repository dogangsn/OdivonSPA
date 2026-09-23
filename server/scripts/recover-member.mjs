import 'dotenv/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

function readOption(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

const email = readOption('email')?.toLowerCase();
const tenantId = readOption('tenant-id');
const name = readOption('name');

if (!email || !tenantId || !name) {
  throw new Error('Kullanım: npm run recover:member -- --email owner@example.com --tenant-id TENANT_ID --name "Sahip Adı"');
}

const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!rawKey) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tanımlı olmalıdır.');

let serviceAccount;
try {
  serviceAccount = JSON.parse(rawKey);
} catch {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY geçerli JSON değil.');
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();
const tenantRef = db.doc(`tenants/${tenantId}`);
const tenant = await tenantRef.get();
if (!tenant.exists || tenant.get('active') !== true) {
  throw new Error(`Aktif tenant bulunamadı: ${tenantId}`);
}

const user = await auth.getUserByEmail(email);
const existingClaims = user.customClaims ?? {};
if (existingClaims.tenantId && existingClaims.tenantId !== tenantId) {
  throw new Error('Kullanıcı zaten başka bir tenant’a bağlı; işlem durduruldu.');
}

const staffRef = tenantRef.collection('staff').doc(user.uid);
const staffByEmail = await Promise.all([
  tenantRef.collection('staff').where('emailNormalized', '==', email).get(),
  tenantRef.collection('staff').where('email', '==', email).get(),
]);
const conflictingStaff = staffByEmail.flatMap((snapshot) => snapshot.docs).filter((doc) => doc.id !== user.uid);
if (conflictingStaff.length > 0) {
  throw new Error('Aynı e-posta farklı bir staff kimliğiyle mevcut. Geçmiş kayıtlara zarar vermemek için işlem durduruldu.');
}

const existingStaff = await staffRef.get();
const role = existingStaff.get('role') ?? 'admin';
if (!['admin', 'reception', 'therapist'].includes(role)) throw new Error('Mevcut staff rolü geçersiz.');

await staffRef.set({
  ad: existingStaff.get('ad') ?? name,
  email,
  emailNormalized: email,
  role,
  uzmanliklar: existingStaff.get('uzmanliklar') ?? [],
  primOraniVarsayilan: existingStaff.get('primOraniVarsayilan') ?? 0,
  renk: existingStaff.get('renk') ?? '#6366f1',
  active: existingStaff.get('active') ?? true,
}, { merge: true });

await auth.setCustomUserClaims(user.uid, { ...existingClaims, tenantId, role });
await tenantRef.collection('auditLogs').add({
  entity: 'membership',
  action: 'callable',
  entityId: user.uid,
  after: { tenantId, role, recovered: true },
  userId: user.uid,
  userEmail: email,
  ip: 'manual-recovery',
  createdAt: FieldValue.serverTimestamp(),
});

console.log(`Üyelik geri yüklendi: ${email} → ${tenantId} (${role})`);
