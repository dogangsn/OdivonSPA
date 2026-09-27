"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sellPackage = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
/** Sells a package and records the money in `payments` so cash register/reports include it. */
exports.sellPackage = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    const ctx = (0, context_1.requireTenantAuth)(request, ['admin', 'reception']);
    const { customerId, packagePlanId, payments } = request.data ?? {};
    if (!customerId || !packagePlanId || !payments?.length) {
        throw new https_1.HttpsError('invalid-argument', 'Müşteri, paket planı ve ödeme zorunludur.');
    }
    const root = admin_1.db.collection('tenants').doc(ctx.tenantId);
    const result = await admin_1.db.runTransaction(async (tx) => {
        const [planSnap, customerSnap] = await Promise.all([
            tx.get(root.collection('packagePlans').doc(packagePlanId)),
            tx.get(root.collection('customers').doc(customerId)),
        ]);
        if (!planSnap.exists)
            throw new https_1.HttpsError('not-found', 'Paket planı bulunamadı.');
        if (!customerSnap.exists)
            throw new https_1.HttpsError('not-found', 'Müşteri bulunamadı.');
        const plan = planSnap.data();
        if (!plan.active)
            throw new https_1.HttpsError('failed-precondition', 'Paket planı aktif değil.');
        const paid = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
        if (Math.abs(paid - plan.fiyat) > 0.01) {
            throw new https_1.HttpsError('failed-precondition', 'Ödeme tutarı paket fiyatına eşit olmalı.');
        }
        const now = new Date();
        const expires = new Date(now.getTime() + plan.gecerlilikGunu * 24 * 60 * 60 * 1000);
        const packageRef = root.collection('customerPackages').doc();
        tx.set(packageRef, {
            customerId,
            packagePlanId,
            toplamSeans: plan.seansAdedi,
            kalanSeans: plan.seansAdedi,
            satisTarihi: firestore_1.Timestamp.fromDate(now),
            bitisTarihi: firestore_1.Timestamp.fromDate(expires),
            status: 'active',
            createdAt: admin_1.FieldValue.serverTimestamp(),
            createdBy: ctx.uid,
        });
        for (const payment of payments) {
            if (payment.amount <= 0)
                continue;
            tx.set(root.collection('payments').doc(), {
                customerId,
                method: payment.method,
                amount: payment.amount,
                note: `Paket satışı: ${plan.ad}`,
                isRefund: false,
                customerPackageId: packageRef.id,
                createdAt: admin_1.FieldValue.serverTimestamp(),
                createdBy: ctx.uid,
            });
        }
        return { customerPackageId: packageRef.id };
    });
    await (0, audit_1.writeAuditLog)({
        tenantId: ctx.tenantId,
        entity: 'customerPackages',
        action: 'callable',
        entityId: result.customerPackageId,
        after: { customerId, packagePlanId },
        actor: ctx,
    });
    return result;
});
//# sourceMappingURL=sell-package.js.map