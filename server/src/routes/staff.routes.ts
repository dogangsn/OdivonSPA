import { Router } from 'express';
import { auth, db, FieldValue, tenantDoc } from '../lib/admin';
import { requireTenantAuth, StaffRole } from '../lib/context';
import { writeAuditLog } from '../lib/audit';
import { ApiError, asyncHandler } from '../lib/errors';

export const staffRouter = Router();

async function countOtherActiveAdmins(tenantId: string, excludingStaffId: string): Promise<number> {
  const snapshot = await db.collection(`tenants/${tenantId}/staff`).where('role', '==', 'admin').where('active', '==', true).get();
  return snapshot.docs.filter((doc) => doc.id !== excludingStaffId).length;
}

/** Guards the "son aktif yöneticinin silinmesi/rol düşürülmesi engellenir" rule from the spec. */
async function assertNotLastActiveAdmin(tenantId: string, staffId: string, staffBefore: { role: string; active: boolean }) {
  const wasActiveAdmin = staffBefore.role === 'admin' && staffBefore.active;
  if (!wasActiveAdmin) return;
  const otherAdmins = await countOtherActiveAdmins(tenantId, staffId);
  if (otherAdmins === 0) {
    throw new ApiError('failed-precondition', 'Son aktif yönetici silinemez veya rolü düşürülemez.');
  }
}

interface InviteStaffBody {
  email?: string;
  ad?: string;
  role?: StaffRole;
}

/** Creates the Auth user + staff profile + custom claims, and returns a password-reset link for the admin to share. */
staffRouter.post(
  '/staff/invite',
  asyncHandler(async (req, res) => {
    const ctx = requireTenantAuth(req, ['admin']);
    const { email, ad, role } = req.body as InviteStaffBody;
    if (!email || !ad || !role) {
      throw new ApiError('invalid-argument', 'E-posta, ad ve rol zorunludur.');
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

    res.json({ staffId: userRecord.uid, resetLink });
  }),
);

interface SetStaffRoleBody {
  role?: StaffRole;
}

staffRouter.patch(
  '/staff/:staffId/role',
  asyncHandler(async (req, res) => {
    const ctx = requireTenantAuth(req, ['admin']);
    const staffId = req.params.staffId;
    const { role } = req.body as SetStaffRoleBody;
    if (!staffId || !role) {
      throw new ApiError('invalid-argument', 'staffId ve role zorunludur.');
    }

    const staffRef = tenantDoc(ctx.tenantId, 'staff', staffId);
    const staffSnap = await staffRef.get();
    if (!staffSnap.exists) {
      throw new ApiError('not-found', 'Personel bulunamadı.');
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

    res.json({ success: true });
  }),
);

staffRouter.post(
  '/staff/:staffId/deactivate',
  asyncHandler(async (req, res) => {
    const ctx = requireTenantAuth(req, ['admin']);
    const staffId = req.params.staffId;
    if (!staffId) {
      throw new ApiError('invalid-argument', 'staffId zorunludur.');
    }

    const staffRef = tenantDoc(ctx.tenantId, 'staff', staffId);
    const staffSnap = await staffRef.get();
    if (!staffSnap.exists) {
      throw new ApiError('not-found', 'Personel bulunamadı.');
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

    res.json({ success: true });
  }),
);
