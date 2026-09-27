"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reopenCashRegisterDay = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
/** Reopens a closed day for correction — the prior snapshot is kept in `reopenHistory`, never overwritten silently. */
exports.reopenCashRegisterDay = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    const ctx = (0, context_1.requireTenantAuth)(request, ['admin']);
    const { date, reason } = request.data ?? {};
    if (!date) {
        throw new https_1.HttpsError('invalid-argument', 'date (YYYY-MM-DD) zorunludur.');
    }
    const dayRef = (0, admin_1.tenantDoc)(ctx.tenantId, 'cashRegisterDays', date);
    const daySnap = await dayRef.get();
    if (!daySnap.exists || daySnap.data()?.['status'] !== 'closed') {
        throw new https_1.HttpsError('failed-precondition', 'Bu gün kapalı değil.');
    }
    // arrayUnion entries can't contain the serverTimestamp() sentinel, so a concrete Date is used here instead.
    await dayRef.update({
        status: 'open',
        reopenHistory: admin_1.FieldValue.arrayUnion({ at: new Date(), by: ctx.uid, reason: reason ?? null }),
    });
    await (0, audit_1.writeAuditLog)({
        tenantId: ctx.tenantId,
        entity: 'cashRegisterDays',
        action: 'callable',
        entityId: date,
        after: { status: 'open', reason },
        actor: ctx,
    });
    return { success: true };
});
//# sourceMappingURL=reopen-cash-register-day.js.map