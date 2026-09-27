import { Router } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { db, FieldValue, tenantCollection, tenantDoc } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';
import { dayBoundsInTz, getTenantTimezone } from '../lib/time';
import { ApiError, asyncHandler } from '../lib/errors';
import { isDateId, PaymentMethod } from '../lib/validation';
import { summarizeCashDay } from '../lib/cash-summary';

export const cashRegisterRouter = Router();

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
    if (!isDateId(date)) {
      throw new ApiError('invalid-argument', 'date (YYYY-MM-DD) zorunludur.');
    }

    const dayRef = tenantDoc(ctx.tenantId, 'cashRegisterDays', date);
    const { start, end } = dayBounds(date, await getTenantTimezone(ctx.tenantId));

    // One transaction: the day-doc read conflicts with checkout/payment writes (which read it too),
    // so a sale can't slip in between totalling and closing, and two concurrent closes can't both win.
    const { netCash, totalIncome, totalExpense } = await db.runTransaction(async (tx) => {
      const daySnap = await tx.get(dayRef);
      if (daySnap.exists && daySnap.data()?.['status'] === 'closed') {
        throw new ApiError('failed-precondition', 'Bu gün zaten kapatılmış.');
      }

      const [sessionsSnap, paymentsSnap, expensesSnap, accrualsSnap] = await Promise.all([
        tx.get(
          tenantCollection(ctx.tenantId, 'sessions')
            .where('createdAt', '>=', start)
            .where('createdAt', '<', end),
        ),
        tx.get(
          tenantCollection(ctx.tenantId, 'payments')
            .where('createdAt', '>=', start)
            .where('createdAt', '<', end),
        ),
        tx.get(
          tenantCollection(ctx.tenantId, 'expenses')
            .where('date', '>=', start)
            .where('date', '<', end),
        ),
        tx.get(
          tenantCollection(ctx.tenantId, 'commissionAccruals')
            .where('date', '>=', start)
            .where('date', '<', end),
        ),
      ]);

      const summary = summarizeCashDay({
        sessions: sessionsSnap.docs.map(
          (d) => d.data() as { payments?: { method: PaymentMethod; amount: number }[] },
        ),
        payments: paymentsSnap.docs.map(
          (d) => d.data() as { method: PaymentMethod; amount: number },
        ),
        expenses: expensesSnap.docs.map((d) => d.data() as { amount: number }),
        accruals: accrualsSnap.docs.map((d) => d.data() as { amount: number }),
      });

      tx.set(
        dayRef,
        {
          date,
          status: 'closed',
          ...summary,
          closedAt: FieldValue.serverTimestamp(),
          closedBy: ctx.uid,
          reopenHistory: daySnap.exists ? (daySnap.data()?.['reopenHistory'] ?? []) : [],
        },
        { merge: false },
      );

      return summary;
    });

    await writeAuditLog({
      tenantId: ctx.tenantId,
      entity: 'cashRegisterDays',
      action: 'callable',
      entityId: date,
      after: { netCash, totalIncome, totalExpense },
      actor: ctx,
    });

    res.json({ date, netCash, totalIncome, totalExpense });
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
    if (!isDateId(date)) {
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
