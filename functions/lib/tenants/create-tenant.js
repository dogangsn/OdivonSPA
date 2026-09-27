"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTenant = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("../lib/admin");
const audit_1 = require("../lib/audit");
/** Onboarding entry point: the caller must already exist as a Firebase Auth user with no tenant claim yet. */
exports.createTenant = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    const callerAuth = request.auth;
    if (!callerAuth) {
        throw new https_1.HttpsError('unauthenticated', 'Bu işlem için giriş yapmanız gerekiyor.');
    }
    if (callerAuth.token['tenantId']) {
        throw new https_1.HttpsError('failed-precondition', 'Bu kullanıcı zaten bir işletmeye bağlı.');
    }
    const businessName = request.data?.businessName?.trim();
    const ownerName = request.data?.ownerName?.trim();
    if (!businessName || !ownerName) {
        throw new https_1.HttpsError('invalid-argument', 'İşletme adı ve ad soyad zorunludur.');
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
        role: 'admin',
        uzmanliklar: [],
        primOraniVarsayilan: 0,
        renk: '#6366f1',
        active: true,
    });
    await admin_1.auth.setCustomUserClaims(callerAuth.uid, { tenantId: tenantRef.id, role: 'admin' });
    await (0, audit_1.writeAuditLog)({
        tenantId: tenantRef.id,
        entity: 'tenants',
        action: 'callable',
        entityId: tenantRef.id,
        after: { name: businessName },
        actor: { uid: callerAuth.uid, email: callerAuth.token['email'] ?? '', ip: request.rawRequest?.ip ?? 'unknown' },
    });
    return { tenantId: tenantRef.id };
});
//# sourceMappingURL=create-tenant.js.map