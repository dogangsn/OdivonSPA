"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutCommissions = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
/** Bulk-marks pending commission accruals as paid and writes a single `expenses` doc (kategori=prim). */
exports.payoutCommissions = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    const ctx = (0, context_1.requireTenantAuth)(request, ['admin']);
    const { staffId, accrualIds } = request.data ?? {};
    if (!staffId || !accrualIds?.length) {
        throw new https_1.HttpsError('invalid-argument', 'staffId ve accrualIds zorunludur.');
    }
    const tenantRoot = admin_1.db.collection('tenants').doc(ctx.tenantId);
    const result = await admin_1.db.runTransaction(async (tx) => {
        const accrualRefs = accrualIds.map((id) => tenantRoot.collection('commissionAccruals').doc(id));
        const accrualSnaps = await Promise.all(accrualRefs.map((ref) => tx.get(ref)));
        let totalAmount = 0;
        for (const snap of accrualSnaps) {
            if (!snap.exists)
                throw new https_1.HttpsError('not-found', 'Tahakkuk kaydı bulunamadı.');
            const accrual = snap.data();
            if (accrual.staffId !== staffId)
                throw new https_1.HttpsError('failed-precondition', 'Tahakkuk bu personele ait değil.');
            if (accrual.status !== 'pending')
                throw new https_1.HttpsError('failed-precondition', 'Sadece bekleyen tahakkuklar ödenebilir.');
            totalAmount += accrual.amount;
        }
        totalAmount = Math.round(totalAmount * 100) / 100;
        const expenseRef = tenantRoot.collection('expenses').doc();
        const payoutRef = tenantRoot.collection('commissionPayouts').doc();
        tx.set(expenseRef, {
            kategori: 'prim',
            amount: totalAmount,
            staffId,
            note: `Prim ödemesi (${accrualIds.length} tahakkuk)`,
            date: admin_1.FieldValue.serverTimestamp(),
            createdAt: admin_1.FieldValue.serverTimestamp(),
            createdBy: ctx.uid,
        });
        tx.set(payoutRef, {
            staffId,
            accrualIds,
            totalAmount,
            expenseId: expenseRef.id,
            createdAt: admin_1.FieldValue.serverTimestamp(),
            createdBy: ctx.uid,
        });
        accrualRefs.forEach((ref) => tx.update(ref, { status: 'paid', payoutId: payoutRef.id }));
        return { payoutId: payoutRef.id, expenseId: expenseRef.id, totalAmount };
    });
    await (0, audit_1.writeAuditLog)({
        tenantId: ctx.tenantId,
        entity: 'commissionPayouts',
        action: 'callable',
        entityId: result.payoutId,
        after: { staffId, totalAmount: result.totalAmount, accrualCount: accrualIds.length },
        actor: ctx,
    });
    return result;
});
//# sourceMappingURL=payout-commissions.js.map