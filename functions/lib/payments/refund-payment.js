"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundPayment = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
/** Creates a reversing negative entry — the original payment is never edited or deleted. */
exports.refundPayment = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    const ctx = (0, context_1.requireTenantAuth)(request, ['admin', 'reception']);
    const { paymentId, reason } = request.data ?? {};
    if (!paymentId) {
        throw new https_1.HttpsError('invalid-argument', 'paymentId zorunludur.');
    }
    const originalRef = (0, admin_1.tenantDoc)(ctx.tenantId, 'payments', paymentId);
    const originalSnap = await originalRef.get();
    if (!originalSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Ödeme kaydı bulunamadı.');
    }
    const original = originalSnap.data();
    if (original.isRefund) {
        throw new https_1.HttpsError('failed-precondition', 'Bir iade kaydı tekrar iade edilemez.');
    }
    const refundRef = (0, admin_1.tenantCollection)(ctx.tenantId, 'payments').doc();
    await refundRef.set({
        customerId: original.customerId ?? null,
        method: original.method,
        amount: -Math.abs(original.amount),
        note: reason ?? 'İade',
        isRefund: true,
        originalPaymentId: paymentId,
        createdAt: admin_1.FieldValue.serverTimestamp(),
        createdBy: ctx.uid,
    });
    await (0, audit_1.writeAuditLog)({
        tenantId: ctx.tenantId,
        entity: 'payments',
        action: 'callable',
        entityId: refundRef.id,
        before: { paymentId, amount: original.amount },
        after: { amount: -Math.abs(original.amount) },
        actor: ctx,
    });
    return { refundId: refundRef.id };
});
//# sourceMappingURL=refund-payment.js.map