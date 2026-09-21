import { Router } from 'express';
import { FieldValue, tenantCollection, tenantDoc } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';
import { ApiError, asyncHandler } from '../lib/errors';

export const paymentsRouter = Router();

interface RefundPaymentBody {
  reason?: string;
}

/** Creates a reversing negative entry — the original payment is never edited or deleted. */
paymentsRouter.post(
  '/payments/:paymentId/refund',
  asyncHandler(async (req, res) => {
    const ctx = requireTenantAuth(req, ['admin', 'reception']);
    const paymentId = req.params.paymentId;
    const { reason } = req.body as RefundPaymentBody;
    if (!paymentId) {
      throw new ApiError('invalid-argument', 'paymentId zorunludur.');
    }

    const originalRef = tenantDoc(ctx.tenantId, 'payments', paymentId);
    const originalSnap = await originalRef.get();
    if (!originalSnap.exists) {
      throw new ApiError('not-found', 'Ödeme kaydı bulunamadı.');
    }
    const original = originalSnap.data() as { amount: number; method: string; customerId?: string; isRefund: boolean };
    if (original.isRefund) {
      throw new ApiError('failed-precondition', 'Bir iade kaydı tekrar iade edilemez.');
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

    res.json({ refundId: refundRef.id });
  }),
);
