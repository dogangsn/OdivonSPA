import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, tenantCollection, tenantDoc } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';

interface RefundPaymentData {
  paymentId: string;
  reason?: string;
}

/** Creates a reversing negative entry — the original payment is never edited or deleted. */
export const refundPayment = onCall<RefundPaymentData>({ region: 'europe-west1' }, async (request) => {
  const ctx = requireTenantAuth(request, ['admin', 'reception']);
  const { paymentId, reason } = request.data ?? {};
  if (!paymentId) {
    throw new HttpsError('invalid-argument', 'paymentId zorunludur.');
  }

  const originalRef = tenantDoc(ctx.tenantId, 'payments', paymentId);
  const originalSnap = await originalRef.get();
  if (!originalSnap.exists) {
    throw new HttpsError('not-found', 'Ödeme kaydı bulunamadı.');
  }
  const original = originalSnap.data() as { amount: number; method: string; customerId?: string; isRefund: boolean };
  if (original.isRefund) {
    throw new HttpsError('failed-precondition', 'Bir iade kaydı tekrar iade edilemez.');
  }

  const refundRef = tenantCollection(ctx.tenantId, 'payments').doc();
  await refundRef.set({
    customerId: original.customerId ?? null,
    method: original.method,
    amount: -Math.abs(original.amount),
    note: reason ?? 'İade',
    isRefund: true,
    originalPaymentId: paymentId,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: ctx.uid,
  });

  await writeAuditLog({
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
