import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';

interface PayoutCommissionsData {
  staffId: string;
  accrualIds: string[];
}

/** Bulk-marks pending commission accruals as paid and writes a single `expenses` doc (kategori=prim). */
export const payoutCommissions = onCall<PayoutCommissionsData>({ region: 'europe-west1' }, async (request) => {
  const ctx = requireTenantAuth(request, ['admin']);
  const { staffId, accrualIds } = request.data ?? {};
  if (!staffId || !accrualIds?.length) {
    throw new HttpsError('invalid-argument', 'staffId ve accrualIds zorunludur.');
  }

  const tenantRoot = db.collection('tenants').doc(ctx.tenantId);

  const result = await db.runTransaction(async (tx) => {
    const accrualRefs = accrualIds.map((id) => tenantRoot.collection('commissionAccruals').doc(id));
    const accrualSnaps = await Promise.all(accrualRefs.map((ref) => tx.get(ref)));

    let totalAmount = 0;
    for (const snap of accrualSnaps) {
      if (!snap.exists) throw new HttpsError('not-found', 'Tahakkuk kaydı bulunamadı.');
      const accrual = snap.data() as { staffId: string; status: string; amount: number };
      if (accrual.staffId !== staffId) throw new HttpsError('failed-precondition', 'Tahakkuk bu personele ait değil.');
      if (accrual.status !== 'pending') throw new HttpsError('failed-precondition', 'Sadece bekleyen tahakkuklar ödenebilir.');
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
      date: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: ctx.uid,
    });

    tx.set(payoutRef, {
      staffId,
      accrualIds,
      totalAmount,
      expenseId: expenseRef.id,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: ctx.uid,
    });

    accrualRefs.forEach((ref) => tx.update(ref, { status: 'paid', payoutId: payoutRef.id }));

    return { payoutId: payoutRef.id, expenseId: expenseRef.id, totalAmount };
  });

  await writeAuditLog({
    tenantId: ctx.tenantId,
    entity: 'commissionPayouts',
    action: 'callable',
    entityId: result.payoutId,
    after: { staffId, totalAmount: result.totalAmount, accrualCount: accrualIds.length },
    actor: ctx,
  });

  return result;
});
