"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffRouter = void 0;
const express_1 = require("express");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
const errors_1 = require("../lib/errors");
exports.staffRouter = (0, express_1.Router)();
async function countOtherActiveAdmins(tenantId, excludingStaffId) {
    const snapshot = await admin_1.db.collection(`tenants/${tenantId}/staff`).where('role', '==', 'admin').where('active', '==', true).get();
    return snapshot.docs.filter((doc) => doc.id !== excludingStaffId).length;
}
/** Guards the "son aktif yöneticinin silinmesi/rol düşürülmesi engellenir" rule from the spec. */
async function assertNotLastActiveAdmin(tenantId, staffId, staffBefore) {
    const wasActiveAdmin = staffBefore.role === 'admin' && staffBefore.active;
    if (!wasActiveAdmin)
        return;
    const otherAdmins = await countOtherActiveAdmins(tenantId, staffId);
    if (otherAdmins === 0) {
        throw new errors_1.ApiError('failed-precondition', 'Son aktif yönetici silinemez veya rolü düşürülemez.');
    }
}
/** Creates the Auth user + staff profile + custom claims, and returns a password-reset link for the admin to share. */
exports.staffRouter.post('/staff/invite', (0, errors_1.asyncHandler)(async (req, res) => {
    const ctx = (0, context_1.requireTenantAuth)(req, ['admin']);
    const { email, ad, role } = req.body;
    if (!email || !ad || !role) {
        throw new errors_1.ApiError('invalid-argument', 'E-posta, ad ve rol zorunludur.');
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
    res.json({ staffId: userRecord.uid, resetLink });
}));
exports.staffRouter.patch('/staff/:staffId/role', (0, errors_1.asyncHandler)(async (req, res) => {
    const ctx = (0, context_1.requireTenantAuth)(req, ['admin']);
    const staffId = req.params.staffId;
    const { role } = req.body;
    if (!staffId || !role) {
        throw new errors_1.ApiError('invalid-argument', 'staffId ve role zorunludur.');
    }
    const staffRef = (0, admin_1.tenantDoc)(ctx.tenantId, 'staff', staffId);
    const staffSnap = await staffRef.get();
    if (!staffSnap.exists) {
        throw new errors_1.ApiError('not-found', 'Personel bulunamadı.');
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
    res.json({ success: true });
}));
exports.staffRouter.post('/staff/:staffId/deactivate', (0, errors_1.asyncHandler)(async (req, res) => {
    const ctx = (0, context_1.requireTenantAuth)(req, ['admin']);
    const staffId = req.params.staffId;
    if (!staffId) {
        throw new errors_1.ApiError('invalid-argument', 'staffId zorunludur.');
    }
    const staffRef = (0, admin_1.tenantDoc)(ctx.tenantId, 'staff', staffId);
    const staffSnap = await staffRef.get();
    if (!staffSnap.exists) {
        throw new errors_1.ApiError('not-found', 'Personel bulunamadı.');
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
    res.json({ success: true });
}));
//# sourceMappingURL=staff.routes.js.map