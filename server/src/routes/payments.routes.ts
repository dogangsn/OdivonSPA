import { Router } from 'express';
import { db, FieldValue, tenantCollection, tenantDoc } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';
import { assertCashDayOpen } from '../lib/cash-day';
import { getTenantTimezone } from '../lib/time';
import { ApiError, asyncHandler } from '../lib/errors';
import { isMoney, isPaymentMethod } from '../lib/validation';

export const paymentsRouter = Router();

interface CreatePaymentBody {
  customerId?: string | null;
  method?: unknown;
  amount?: unknown;
  note?: string;
}

const MAX_NOTE_LENGTH = 500;

/** Manual (non-session) payment. Moved server-side so amount, author and the cash-day lock can't be bypassed. */
paymentsRouter.post(
  '/payments',
  asyncHandler(async (req, res) => {
    const ctx = requireTenantAuth(req, ['admin', 'reception']);
    const { customerId, method, amount, note } = req.body as CreatePaymentBody;
    if (!isPaymentMethod(method)) {
      throw new ApiError('invalid-argument', 'Geçersiz ödeme yöntemi.');
    }
    if (!isMoney(amount) || amount <= 0) {
      throw new ApiError('invalid-argument', 'Tutar sıfırdan büyük olmalıdır.');
    }
    if (note != null && (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH)) {
      throw new ApiError('invalid-argument', `Not en fazla ${MAX_NOTE_LENGTH} karakter olabilir.`);
    }
    if (customerId != null && typeof customerId !== 'string') {
      throw new ApiError('invalid-argument', 'Geçersiz müşteri.');
    }

    const timeZone = await getTenantTimezone(ctx.tenantId);
    const paymentRef = tenantCollection(ctx.tenantId, 'payments').doc();

    await db.runTransaction(async (tx) => {
      await assertCashDayOpen(tx, ctx.tenantId, timeZone);
      if (customerId) {
        const customerSnap = await tx.get(tenantDoc(ctx.tenantId, 'customers', customerId));
        if (!customerSnap.exists) throw new ApiError('not-found', 'Müşteri bulunamadı.');
      }
      tx.set(paymentRef, {
        customerId: customerId || null,
        method,
        amount,
        note: note?.trim() || null,
        isRefund: false,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: ctx.uid,
      });
    });

    await writeAuditLog({
      tenantId: ctx.tenantId,
      entity: 'payments',
      action: 'callable',
      entityId: paymentRef.id,
      after: { method, amount, customerId: customerId || null },
      actor: ctx,
    });

    res.json({ paymentId: paymentRef.id });
  }),
);

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
    if (reason != null && (typeof reason !== 'string' || reason.length > MAX_NOTE_LENGTH)) {
      throw new ApiError('invalid-argument', `İade nedeni en fazla ${MAX_NOTE_LENGTH} karakter olabilir.`);
    }

    const timeZone = await getTenantTimezone(ctx.tenantId);
    const originalRef = tenantDoc(ctx.tenantId, 'payments', paymentId);
    const refundRef = tenantCollection(ctx.tenantId, 'payments').doc();

    const original = await db.runTransaction(async (tx) => {
      await assertCashDayOpen(tx, ctx.tenantId, timeZone);

      const originalSnap = await tx.get(originalRef);
      if (!originalSnap.exists) {
        throw new ApiError('not-found', 'Ödeme kaydı bulunamadı.');
      }
      const data = originalSnap.data() as { amount: number; method: string; customerId?: string; isRefund: boolean; refundId?: string };
      if (data.isRefund) {
        throw new ApiError('failed-precondition', 'Bir iade kaydı tekrar iade edilemez.');
      }
      // `refundId` marks refunds made from now on; the query also catches refunds created before that field existed.
      const priorRefunds = await tx.get(tenantCollection(ctx.tenantId, 'payments').where('originalPaymentId', '==', paymentId).limit(1));
      if (data.refundId || !priorRefunds.empty) {
        throw new ApiError('failed-precondition', 'Bu ödeme zaten iade edilmiş.');
      }

      tx.set(refundRef, {
        customerId: data.customerId ?? null,
        method: data.method,
        amount: -Math.abs(data.amount),
        note: reason?.trim() || 'İade',
        isRefund: true,
        originalPaymentId: paymentId,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: ctx.uid,
      });
      tx.update(originalRef, { refundId: refundRef.id });
      return data;
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
