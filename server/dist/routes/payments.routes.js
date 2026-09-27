"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = require("express");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
const errors_1 = require("../lib/errors");
exports.paymentsRouter = (0, express_1.Router)();
/** Creates a reversing negative entry — the original payment is never edited or deleted. */
exports.paymentsRouter.post('/payments/:paymentId/refund', (0, errors_1.asyncHandler)(async (req, res) => {
    const ctx = (0, context_1.requireTenantAuth)(req, ['admin', 'reception']);
    const paymentId = req.params.paymentId;
    const { reason } = req.body;
    if (!paymentId) {
        throw new errors_1.ApiError('invalid-argument', 'paymentId zorunludur.');
    }
    const originalRef = (0, admin_1.tenantDoc)(ctx.tenantId, 'payments', paymentId);
    const originalSnap = await originalRef.get();
    if (!originalSnap.exists) {
        throw new errors_1.ApiError('not-found', 'Ödeme kaydı bulunamadı.');
    }
    const original = originalSnap.data();
    if (original.isRefund) {
        throw new errors_1.ApiError('failed-precondition', 'Bir iade kaydı tekrar iade edilemez.');
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
    res.json({ refundId: refundRef.id });
}));
//# sourceMappingURL=payments.routes.js.map