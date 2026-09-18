import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { FieldValue, tenantCollection, tenantDoc } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';

type PaymentMethod = 'nakit' | 'kart' | 'havale' | 'diger';

interface CloseCashRegisterDayData {
  date: string; // YYYY-MM-DD
}

function dayBounds(dateStr: string): { start: Timestamp; end: Timestamp } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

/** Snapshots the day's totals from sessions/payments/expenses into `cashRegisterDays/{date}`. */
export const closeCashRegisterDay = onCall<CloseCashRegisterDayData>({ region: 'europe-west1' }, async (request) => {
  const ctx = requireTenantAuth(request, ['admin', 'reception']);
  const { date } = request.data ?? {};
  if (!date) {
    throw new HttpsError('invalid-argument', 'date (YYYY-MM-DD) zorunludur.');
  }

  const dayRef = tenantDoc(ctx.tenantId, 'cashRegisterDays', date);
  const daySnap = await dayRef.get();
  if (daySnap.exists && daySnap.data()?.['status'] === 'closed') {
    throw new HttpsError('failed-precondition', 'Bu gün zaten kapatılmış.');
  }

  const { start, end } = dayBounds(date);

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

  return { date, netCash, totalIncome: round2(totalIncome), totalExpense: round2(totalExpense) };
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
