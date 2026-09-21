import { Router } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { FieldValue, tenantCollection, tenantDoc } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';
import { dayBoundsInTz, getTenantTimezone } from '../lib/time';
import { ApiError, asyncHandler } from '../lib/errors';

export const cashRegisterRouter = Router();

type PaymentMethod = 'nakit' | 'kart' | 'havale' | 'diger';

function dayBounds(dateStr: string, timeZone: string): { start: Timestamp; end: Timestamp } {
  const { start, end } = dayBoundsInTz(dateStr, timeZone);
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

/** Snapshots the day's totals from sessions/payments/expenses into `cashRegisterDays/{date}`. */
cashRegisterRouter.post(
  '/cash-register-days/:date/close',
  asyncHandler(async (req, res) => {
    const ctx = requireTenantAuth(req, ['admin', 'reception']);
    const date = req.params.date;
    if (!date) {
      throw new ApiError('invalid-argument', 'date (YYYY-MM-DD) zorunludur.');
    }

    const dayRef = tenantDoc(ctx.tenantId, 'cashRegisterDays', date);
    const daySnap = await dayRef.get();
    if (daySnap.exists && daySnap.data()?.['status'] === 'closed') {
      throw new ApiError('failed-precondition', 'Bu gün zaten kapatılmış.');
    }

    const { start, end } = dayBounds(date, await getTenantTimezone(ctx.tenantId));

    const [sessionsSnap, paymentsSnap, expensesSnap, accrualsSnap] = await Promise.all([
      tenantCollection(ctx.tenantId, 'sessions').where('createdAt', '>=', start).where('createdAt', '<', end).get(),
      tenantCollection(ctx.tenantId, 'payments').where('createdAt', '>=', start).where('createdAt', '<', end).get(),
      tenantCollection(ctx.tenantId, 'expenses').where('date', '>=', start).where('date', '<', end).get(),
      tenantCollection(ctx.tenantId, 'commissionAccruals').where('date', '>=', start).where('date', '<', end).get(),
    ]);

    const totalsByMethod: Partial<Record<PaymentMethod, number>> = {};
    const addToMethod = (method: PaymentMethod, amount: number) => {
      totalsByMethod[method] = round2((totalsByMethod[method] ?? 0) + amount);
    };

    let totalIncome = 0;
    for (const doc of sessionsSnap.docs) {
      const session = doc.data() as { payments: { method: PaymentMethod; amount: number }[] };
      for (const payment of session.payments ?? []) {
        addToMethod(payment.method, payment.amount);
        totalIncome += payment.amount;
      }
    }
    for (const doc of paymentsSnap.docs) {
      const payment = doc.data() as { method: PaymentMethod; amount: number };
      addToMethod(payment.method, payment.amount);
      totalIncome += payment.amount;
    }

    const totalExpense = expensesSnap.docs.reduce((sum, doc) => sum + (doc.data()['amount'] as number), 0);
    const totalCommission = accrualsSnap.docs.reduce((sum, doc) => sum + (doc.data()['amount'] as number), 0);

    const netCash = round2(totalIncome - totalExpense);

    await dayRef.set(
      {
        date,
        status: 'closed',
        totalsByMethod,
        totalIncome: round2(totalIncome),
        totalExpense: round2(totalExpense),
        totalCommission: round2(totalCommission),
        netCash,
        closedAt: FieldValue.serverTimestamp(),
        closedBy: ctx.uid,
        reopenHistory: daySnap.exists ? daySnap.data()?.['reopenHistory'] ?? [] : [],
      },
      { merge: false },
    );

    await writeAuditLog({
      tenantId: ctx.tenantId,
      entity: 'cashRegisterDays',
      action: 'callable',
      entityId: date,
      after: { netCash, totalIncome, totalExpense },
      actor: ctx,
    });

    res.json({ date, netCash, totalIncome: round2(totalIncome), totalExpense: round2(totalExpense) });
  }),
);

interface ReopenCashRegisterDayBody {
  reason?: string;
}

/** Reopens a closed day for correction — the prior snapshot is kept in `reopenHistory`, never overwritten silently. */
cashRegisterRouter.post(
  '/cash-register-days/:date/reopen',
  asyncHandler(async (req, res) => {
    const ctx = requireTenantAuth(req, ['admin']);
    const date = req.params.date;
    const { reason } = req.body as ReopenCashRegisterDayBody;
    if (!date) {
      throw new ApiError('invalid-argument', 'date (YYYY-MM-DD) zorunludur.');
    }

    const dayRef = tenantDoc(ctx.tenantId, 'cashRegisterDays', date);
    const daySnap = await dayRef.get();
    if (!daySnap.exists || daySnap.data()?.['status'] !== 'closed') {
      throw new ApiError('failed-precondition', 'Bu gün kapalı değil.');
    }

    // arrayUnion entries can't contain the serverTimestamp() sentinel, so a concrete Date is used here instead.
    await dayRef.update({
      status: 'open',
      reopenHistory: FieldValue.arrayUnion({ at: new Date(), by: ctx.uid, reason: reason ?? null }),
    });

    await writeAuditLog({
      tenantId: ctx.tenantId,
      entity: 'cashRegisterDays',
      action: 'callable',
      entityId: date,
      after: { status: 'open', reason },
      actor: ctx,
    });

    res.json({ success: true });
  }),
);

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
