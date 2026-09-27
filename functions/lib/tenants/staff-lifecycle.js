"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivateStaffUser = exports.setStaffRole = exports.inviteStaffUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
async function countOtherActiveAdmins(tenantId, excludingStaffId) {
    const snapshot = await admin_1.db
        .collection(`tenants/${tenantId}/staff`)
        .where('role', '==', 'admin')
        .where('active', '==', true)
        .get();
    return snapshot.docs.filter((doc) => doc.id !== excludingStaffId).length;
}
/** Guards the "son aktif yöneticinin silinmesi/rol düşürülmesi engellenir" rule from the spec. */
async function assertNotLastActiveAdmin(tenantId, staffId, staffBefore) {
    const wasActiveAdmin = staffBefore.role === 'admin' && staffBefore.active;
    if (!wasActiveAdmin)
        return;
    const otherAdmins = await countOtherActiveAdmins(tenantId, staffId);
    if (otherAdmins === 0) {
        throw new https_1.HttpsError('failed-precondition', 'Son aktif yönetici silinemez veya rolü düşürülemez.');
    }
}
/** Creates the Auth user + staff profile + custom claims, and returns a password-reset link for the admin to share. */
exports.inviteStaffUser = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    const ctx = (0, context_1.requireTenantAuth)(request, ['admin']);
    const { email, ad, role } = request.data ?? {};
    if (!email || !ad || !role) {
        throw new https_1.HttpsError('invalid-argument', 'E-posta, ad ve rol zorunludur.');
    }
    const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const userRecord = await admin_1.auth.createUser({ email, password: tempPassword, displayName: ad });
    await admin_1.auth.setCustomUserClaims(userRecord.uid, { tenantId: ctx.tenantId, role });
    await (0, admin_1.tenantDoc)(ctx.tenantId, 'staff', userRecord.uid).set({
        ad,
        email,
        role,
        uzmanliklar: [],
        primOraniVarsayilan: 0,
        renk: '#6366f1',
        active: true,
    });
    const resetLink = await admin_1.auth.generatePasswordResetLink(email);
    await (0, audit_1.writeAuditLog)({
        tenantId: ctx.tenantId,
        entity: 'staff',
        action: 'callable',
        entityId: userRecord.uid,
        after: { ad, email, role },
        actor: ctx,
    });
    return { staffId: userRecord.uid, resetLink };
});
exports.setStaffRole = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    const ctx = (0, context_1.requireTenantAuth)(request, ['admin']);
    const { staffId, role } = request.data ?? {};
    if (!staffId || !role) {
        throw new https_1.HttpsError('invalid-argument', 'staffId ve role zorunludur.');
    }
    const staffRef = (0, admin_1.tenantDoc)(ctx.tenantId, 'staff', staffId);
    const staffSnap = await staffRef.get();
    if (!staffSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Personel bulunamadı.');
    }
    const before = staffSnap.data();
    await assertNotLastActiveAdmin(ctx.tenantId, staffId, before);
    await admin_1.auth.setCustomUserClaims(staffId, { tenantId: ctx.tenantId, role });
    await staffRef.update({ role, updatedAt: admin_1.FieldValue.serverTimestamp(), updatedBy: ctx.uid });
    await (0, audit_1.writeAuditLog)({
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
exports.deactivateStaffUser = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    const ctx = (0, context_1.requireTenantAuth)(request, ['admin']);
    const { staffId } = request.data ?? {};
    if (!staffId) {
        throw new https_1.HttpsError('invalid-argument', 'staffId zorunludur.');
    }
    const staffRef = (0, admin_1.tenantDoc)(ctx.tenantId, 'staff', staffId);
    const staffSnap = await staffRef.get();
    if (!staffSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Personel bulunamadı.');
    }
    const before = staffSnap.data();
    await assertNotLastActiveAdmin(ctx.tenantId, staffId, before);
    await admin_1.auth.updateUser(staffId, { disabled: true });
    await staffRef.update({ active: false, updatedAt: admin_1.FieldValue.serverTimestamp(), updatedBy: ctx.uid });
    await (0, audit_1.writeAuditLog)({
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
//# sourceMappingURL=staff-lifecycle.js.map