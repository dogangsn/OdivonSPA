"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cashRegisterRouter = void 0;
const express_1 = require("express");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
const time_1 = require("../lib/time");
const errors_1 = require("../lib/errors");
exports.cashRegisterRouter = (0, express_1.Router)();
function dayBounds(dateStr, timeZone) {
    const { start, end } = (0, time_1.dayBoundsInTz)(dateStr, timeZone);
    return { start: firestore_1.Timestamp.fromDate(start), end: firestore_1.Timestamp.fromDate(end) };
}
/** Snapshots the day's totals from sessions/payments/expenses into `cashRegisterDays/{date}`. */
exports.cashRegisterRouter.post('/cash-register-days/:date/close', (0, errors_1.asyncHandler)(async (req, res) => {
    const ctx = (0, context_1.requireTenantAuth)(req, ['admin', 'reception']);
    const date = req.params.date;
    if (!date) {
        throw new errors_1.ApiError('invalid-argument', 'date (YYYY-MM-DD) zorunludur.');
    }
    const dayRef = (0, admin_1.tenantDoc)(ctx.tenantId, 'cashRegisterDays', date);
    const daySnap = await dayRef.get();
    if (daySnap.exists && daySnap.data()?.['status'] === 'closed') {
        throw new errors_1.ApiError('failed-precondition', 'Bu gün zaten kapatılmış.');
    }
    const { start, end } = dayBounds(date, await (0, time_1.getTenantTimezone)(ctx.tenantId));
    const [sessionsSnap, paymentsSnap, expensesSnap, accrualsSnap] = await Promise.all([
        (0, admin_1.tenantCollection)(ctx.tenantId, 'sessions').where('createdAt', '>=', start).where('createdAt', '<', end).get(),
        (0, admin_1.tenantCollection)(ctx.tenantId, 'payments').where('createdAt', '>=', start).where('createdAt', '<', end).get(),
        (0, admin_1.tenantCollection)(ctx.tenantId, 'expenses').where('date', '>=', start).where('date', '<', end).get(),
        (0, admin_1.tenantCollection)(ctx.tenantId, 'commissionAccruals').where('date', '>=', start).where('date', '<', end).get(),
    ]);
    const totalsByMethod = {};
    const addToMethod = (method, amount) => {
        totalsByMethod[method] = round2((totalsByMethod[method] ?? 0) + amount);
    };
    let totalIncome = 0;
    for (const doc of sessionsSnap.docs) {
        const session = doc.data();
        for (const payment of session.payments ?? []) {
            addToMethod(payment.method, payment.amount);
            totalIncome += payment.amount;
        }
    }
    for (const doc of paymentsSnap.docs) {
        const payment = doc.data();
        addToMethod(payment.method, payment.amount);
        totalIncome += payment.amount;
    }
    const totalExpense = expensesSnap.docs.reduce((sum, doc) => sum + doc.data()['amount'], 0);
    const totalCommission = accrualsSnap.docs.reduce((sum, doc) => sum + doc.data()['amount'], 0);
    const netCash = round2(totalIncome - totalExpense);
    await dayRef.set({
        date,
        status: 'closed',
        totalsByMethod,
        totalIncome: round2(totalIncome),
        totalExpense: round2(totalExpense),
        totalCommission: round2(totalCommission),
        netCash,
        closedAt: admin_1.FieldValue.serverTimestamp(),
        closedBy: ctx.uid,
        reopenHistory: daySnap.exists ? daySnap.data()?.['reopenHistory'] ?? [] : [],
    }, { merge: false });
    await (0, audit_1.writeAuditLog)({
        tenantId: ctx.tenantId,
        entity: 'cashRegisterDays',
        action: 'callable',
        entityId: date,
        after: { netCash, totalIncome, totalExpense },
        actor: ctx,
    });
    res.json({ date, netCash, totalIncome: round2(totalIncome), totalExpense: round2(totalExpense) });
}));
/** Reopens a closed day for correction — the prior snapshot is kept in `reopenHistory`, never overwritten silently. */
exports.cashRegisterRouter.post('/cash-register-days/:date/reopen', (0, errors_1.asyncHandler)(async (req, res) => {
    const ctx = (0, context_1.requireTenantAuth)(req, ['admin']);
    const date = req.params.date;
    const { reason } = req.body;
    if (!date) {
        throw new errors_1.ApiError('invalid-argument', 'date (YYYY-MM-DD) zorunludur.');
    }
    const dayRef = (0, admin_1.tenantDoc)(ctx.tenantId, 'cashRegisterDays', date);
    const daySnap = await dayRef.get();
    if (!daySnap.exists || daySnap.data()?.['status'] !== 'closed') {
        throw new errors_1.ApiError('failed-precondition', 'Bu gün kapalı değil.');
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
    res.json({ success: true });
}));
function round2(value) {
    return Math.round(value * 100) / 100;
}
//# sourceMappingURL=cash-register.routes.js.map