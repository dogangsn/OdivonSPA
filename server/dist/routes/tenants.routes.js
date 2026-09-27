"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantsRouter = void 0;
const express_1 = require("express");
const admin_1 = require("../lib/admin");
const audit_1 = require("../lib/audit");
const context_1 = require("../lib/context");
const errors_1 = require("../lib/errors");
const membership_1 = require("../lib/membership");
exports.tenantsRouter = (0, express_1.Router)();
/** Restores an access claim only when the verified caller has one unambiguous active staff record. */
exports.tenantsRouter.post('/membership/resolve', (0, errors_1.asyncHandler)(async (req, res) => {
    const callerAuth = req.auth;
    if (!callerAuth)
        throw new errors_1.ApiError('unauthenticated', 'Bu işlem için giriş yapmanız gerekiyor.');
    const result = await (0, membership_1.resolveMembership)(callerAuth.uid, callerAuth.token);
    if (result.status === 'ambiguous') {
        throw new errors_1.ApiError('failed-precondition', 'Bu e-posta birden fazla işletmeyle eşleşiyor. Lütfen destek ekibiyle iletişime geçin.');
    }
    res.json(result);
}));
/** Onboarding entry point: the caller must already exist as a Firebase Auth user with no tenant claim yet. */
exports.tenantsRouter.post('/tenants', (0, errors_1.asyncHandler)(async (req, res) => {
    const callerAuth = req.auth;
    if (!callerAuth) {
        throw new errors_1.ApiError('unauthenticated', 'Bu işlem için giriş yapmanız gerekiyor.');
    }
    const membership = await (0, membership_1.resolveMembership)(callerAuth.uid, callerAuth.token);
    if (membership.status === 'claimed') {
        throw new errors_1.ApiError('failed-precondition', 'Bu kullanıcı zaten bir işletmeye bağlı.');
    }
    if (membership.status === 'restored') {
        res.json({ tenantId: membership.tenantId, restored: true });
        return;
    }
    if (membership.status === 'ambiguous') {
        throw new errors_1.ApiError('failed-precondition', 'Bu e-posta birden fazla işletmeyle eşleşiyor. Yeni işletme kaydı oluşturulamadı; lütfen destek ekibiyle iletişime geçin.');
    }
    const body = req.body;
    const businessName = body?.businessName?.trim();
    const ownerName = body?.ownerName?.trim();
    if (!businessName || !ownerName) {
        throw new errors_1.ApiError('invalid-argument', 'İşletme adı ve ad soyad zorunludur.');
    }
    const tenantRef = admin_1.db.collection('tenants').doc();
    await tenantRef.set({
        name: businessName,
        plan: 'trial',
        active: true,
        createdAt: admin_1.FieldValue.serverTimestamp(),
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
    await (0, membership_1.setMembershipClaims)(callerAuth.uid, { tenantId: tenantRef.id, role: 'admin' });
    await (0, audit_1.writeAuditLog)({
        tenantId: tenantRef.id,
        entity: 'tenants',
        action: 'callable',
        entityId: tenantRef.id,
        after: { name: businessName },
        actor: { uid: callerAuth.uid, email: callerAuth.token['email'] ?? '', ip: (0, context_1.getClientIp)(req) },
    });
    res.json({ tenantId: tenantRef.id });
}));
//# sourceMappingURL=tenants.routes.js.map