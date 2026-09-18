import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, tenantDoc } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';

interface ReopenCashRegisterDayData {
  date: string;
  reason?: string;
}

/** Reopens a closed day for correction — the prior snapshot is kept in `reopenHistory`, never overwritten silently. */
export const reopenCashRegisterDay = onCall<ReopenCashRegisterDayData>({ region: 'europe-west1' }, async (request) => {
  const ctx = requireTenantAuth(request, ['admin']);
  const { date, reason } = request.data ?? {};
  if (!date) {
    throw new HttpsError('invalid-argument', 'date (YYYY-MM-DD) zorunludur.');
  }

  const dayRef = tenantDoc(ctx.tenantId, 'cashRegisterDays', date);
  const daySnap = await dayRef.get();
  if (!daySnap.exists || daySnap.data()?.['status'] !== 'closed') {
    throw new HttpsError('failed-precondition', 'Bu gün kapalı değil.');
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

  return { success: true };
});
