import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { auth, db, FieldValue, tenantDoc } from '../lib/admin';
import { requireTenantAuth, StaffRole } from '../lib/context';
import { writeAuditLog } from '../lib/audit';

async function countOtherActiveAdmins(tenantId: string, excludingStaffId: string): Promise<number> {
  const snapshot = await db
    .collection(`tenants/${tenantId}/staff`)
    .where('role', '==', 'admin')
    .where('active', '==', true)
    .get();
  return snapshot.docs.filter((doc) => doc.id !== excludingStaffId).length;
}

/** Guards the "son aktif yöneticinin silinmesi/rol düşürülmesi engellenir" rule from the spec. */
async function assertNotLastActiveAdmin(tenantId: string, staffId: string, staffBefore: { role: string; active: boolean }) {
  const wasActiveAdmin = staffBefore.role === 'admin' && staffBefore.active;
  if (!wasActiveAdmin) return;
  const otherAdmins = await countOtherActiveAdmins(tenantId, staffId);
  if (otherAdmins === 0) {
    throw new HttpsError('failed-precondition', 'Son aktif yönetici silinemez veya rolü düşürülemez.');
  }
}

interface InviteStaffData {
  email: string;
  ad: string;
  role: StaffRole;
}

/** Creates the Auth user + staff profile + custom claims, and returns a password-reset link for the admin to share. */
export const inviteStaffUser = onCall<InviteStaffData>({ region: 'europe-west1' }, async (request) => {
  const ctx = requireTenantAuth(request, ['admin']);
  const { email, ad, role } = request.data ?? {};
  if (!email || !ad || !role) {
    throw new HttpsError('invalid-argument', 'E-posta, ad ve rol zorunludur.');
  }

  const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const userRecord = await auth.createUser({ email, password: tempPassword, displayName: ad });
  await auth.setCustomUserClaims(userRecord.uid, { tenantId: ctx.tenantId, role });

  await tenantDoc(ctx.tenantId, 'staff', userRecord.uid).set({
    ad,
    email,
    role,
    uzmanliklar: [],
    primOraniVarsayilan: 0,
    renk: '#6366f1',
    active: true,
  });

  const resetLink = await auth.generatePasswordResetLink(email);

  await writeAuditLog({
    tenantId: ctx.tenantId,
    entity: 'staff',
    action: 'callable',
    entityId: userRecord.uid,
    after: { ad, email, role },
    actor: ctx,
  });

  return { staffId: userRecord.uid, resetLink };
});

interface SetStaffRoleData {
  staffId: string;
  role: StaffRole;
}

export const setStaffRole = onCall<SetStaffRoleData>({ region: 'europe-west1' }, async (request) => {
  const ctx = requireTenantAuth(request, ['admin']);
  const { staffId, role } = request.data ?? {};
  if (!staffId || !role) {
    throw new HttpsError('invalid-argument', 'staffId ve role zorunludur.');
  }

  const staffRef = tenantDoc(ctx.tenantId, 'staff', staffId);
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    throw new HttpsError('not-found', 'Personel bulunamadı.');
  }
  const before = staffSnap.data() as { role: string; active: boolean };

  await assertNotLastActiveAdmin(ctx.tenantId, staffId, before);

  await auth.setCustomUserClaims(staffId, { tenantId: ctx.tenantId, role });
  await staffRef.update({ role, updatedAt: FieldValue.serverTimestamp(), updatedBy: ctx.uid });

  await writeAuditLog({
    tenantId: ctx.tenantId,
    entity: 'staff',
    action: 'callable',
    entityId: staffId,
    before: { role: before.role },
    after: { role },
    actor: ctx,
  });

  return { success: true };
});

interface DeactivateStaffData {
  staffId: string;
}

export const deactivateStaffUser = onCall<DeactivateStaffData>({ region: 'europe-west1' }, async (request) => {
  const ctx = requireTenantAuth(request, ['admin']);
  const { staffId } = request.data ?? {};
  if (!staffId) {
    throw new HttpsError('invalid-argument', 'staffId zorunludur.');
  }

  const staffRef = tenantDoc(ctx.tenantId, 'staff', staffId);
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    throw new HttpsError('not-found', 'Personel bulunamadı.');
  }
  const before = staffSnap.data() as { role: string; active: boolean };

  await assertNotLastActiveAdmin(ctx.tenantId, staffId, before);

  await auth.updateUser(staffId, { disabled: true });
  await staffRef.update({ active: false, updatedAt: FieldValue.serverTimestamp(), updatedBy: ctx.uid });

  await writeAuditLog({
    tenantId: ctx.tenantId,
    entity: 'staff',
    action: 'callable',
    entityId: staffId,
    before: { active: true },
    after: { active: false },
    actor: ctx,
  });

  return { success: true };
});
