import { Router } from 'express';
import { db, FieldValue } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';
import { dateStampInTz, getTenantTimezone } from '../lib/time';
import { CommissionRuleRecord } from '../commissions/commission-engine';
import { ApiError, asyncHandler } from '../lib/errors';
import { assertCashDayOpen } from '../lib/cash-day';
import { assertPayments, isMoney, isPositiveInt, MAX_LINE_QTY, PaymentMethod } from '../lib/validation';
import {
  CheckoutItemInput,
  CustomerPackageRecord,
  priceCheckout,
  ProductRecord,
  ServiceRecord,
} from '../lib/checkout-pricing';

export const posRouter = Router();

interface CheckoutSessionBody {
  appointmentId?: string;
  customerId: string;
  staffId: string;
  roomId: string;
  items: CheckoutItemInput[];
  payments: { method: PaymentMethod; amount: number }[];
  discountAmount?: number;
}

posRouter.post(
  '/pos/checkout-session',
  asyncHandler(async (req, res) => {
    const ctx = requireTenantAuth(req, ['admin', 'reception', 'therapist']);
    const data = req.body as CheckoutSessionBody;

    if (!data?.customerId || !data?.staffId || !data?.roomId || !data.items?.length) {
      throw new ApiError('invalid-argument', 'Müşteri, terapist, oda ve en az bir hizmet/ürün zorunludur.');
    }
    for (const item of data.items) {
      if (item?.kind !== 'service' && item?.kind !== 'product') {
        throw new ApiError('invalid-argument', 'Geçersiz satır türü.');
      }
      if (!item.refId || typeof item.refId !== 'string') {
        throw new ApiError('invalid-argument', 'Satırda hizmet/ürün seçilmemiş.');
      }
      if (!isPositiveInt(item.qty, MAX_LINE_QTY)) {
        throw new ApiError('invalid-argument', `Adet 1 ile ${MAX_LINE_QTY} arasında tam sayı olmalıdır.`);
      }
      if (item.discount != null && !isMoney(item.discount)) {
        throw new ApiError('invalid-argument', 'Satır indirimi geçerli ve negatif olmayan bir tutar olmalıdır.');
      }
      if (item.customerPackageId != null && (item.kind !== 'service' || typeof item.customerPackageId !== 'string')) {
        throw new ApiError('invalid-argument', 'Paket kullanımı yalnızca hizmet satırında yapılabilir.');
      }
    }
    if (data.discountAmount != null && !isMoney(data.discountAmount)) {
      throw new ApiError('invalid-argument', 'Genel indirim geçerli ve negatif olmayan bir tutar olmalıdır.');
    }
    // A fully package-redeemed session has nothing to charge, so an empty payments list is valid.
    const payments = assertPayments(data.payments ?? [], { allowEmpty: true });

    const tenantRoot = db.collection('tenants').doc(ctx.tenantId);
    const globalDiscount = data.discountAmount ?? 0;
    const timeZone = await getTenantTimezone(ctx.tenantId);

    const result = await db.runTransaction(async (tx) => {
      // ---- Reads ----
      await assertCashDayOpen(tx, ctx.tenantId, timeZone);
      const staffSnap = await tx.get(tenantRoot.collection('staff').doc(data.staffId));
      if (!staffSnap.exists) throw new ApiError('not-found', 'Terapist bulunamadı.');
      const staffData = staffSnap.data() as { primOraniVarsayilan: number };

      const serviceRefs = data.items.filter((i) => i.kind === 'service').map((i) => i.refId);
      const productRefs = data.items.filter((i) => i.kind === 'product').map((i) => i.refId);
      const packageRefs = data.items.filter((i) => i.customerPackageId).map((i) => i.customerPackageId!);

      const serviceSnaps = await Promise.all(serviceRefs.map((id) => tx.get(tenantRoot.collection('services').doc(id))));
      const productSnaps = await Promise.all(productRefs.map((id) => tx.get(tenantRoot.collection('products').doc(id))));
      const packageSnaps = await Promise.all(packageRefs.map((id) => tx.get(tenantRoot.collection('customerPackages').doc(id))));
      const rulesSnap = await tx.get(tenantRoot.collection('commissionRules').where('active', '==', true));
      if (data.appointmentId) {
        const apptSnap = await tx.get(tenantRoot.collection('appointments').doc(data.appointmentId));
        if (!apptSnap.exists) throw new ApiError('not-found', 'Randevu bulunamadı.');
        if (!['Bekliyor', 'Onaylandı', 'Geldi'].includes(apptSnap.data()?.['status'])) {
          throw new ApiError('failed-precondition', 'Bu randevu zaten kapatılmış (tamamlandı, iptal veya gelmedi).');
        }
      }

      const priced = priceCheckout({
        customerId: data.customerId,
        staffId: data.staffId,
        staffDefaultPercent: staffData.primOraniVarsayilan ?? 0,
        items: data.items,
        payments,
        globalDiscount,
        services: new Map(serviceSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as ServiceRecord])),
        products: new Map(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as ProductRecord])),
        packages: new Map(packageSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as CustomerPackageRecord])),
        rules: rulesSnap.docs.map((d) => d.data() as CommissionRuleRecord),
        now: Date.now(),
      });
      const { totalAmount, resolvedItems, commissionLines, productDecrements, packageDecrements } = priced;

      // ---- Sequential receipt number ----
      const counterRef = tenantRoot.collection('counters').doc('sessions');
      const counterSnap = await tx.get(counterRef);
      const nextSeq = ((counterSnap.data()?.['value'] as number) ?? 0) + 1;
      const receiptNo = `S-${dateStampInTz(timeZone)}-${String(nextSeq).padStart(4, '0')}`;

      // ---- Writes ----
      const sessionRef = tenantRoot.collection('sessions').doc();
      const accrualRefs = commissionLines.map(() => tenantRoot.collection('commissionAccruals').doc());

      tx.set(counterRef, { value: nextSeq }, { merge: true });

      accrualRefs.forEach((ref, idx) => {
        tx.set(ref, {
          staffId: commissionLines[idx].staffId,
          sessionId: sessionRef.id,
          amount: commissionLines[idx].amount,
          status: 'pending',
          date: FieldValue.serverTimestamp(),
        });
      });

      tx.set(sessionRef, {
        appointmentId: data.appointmentId ?? null,
        customerId: data.customerId,
        staffId: data.staffId,
        roomId: data.roomId,
        items: resolvedItems,
        totalAmount,
        discountAmount: globalDiscount,
        payments,
        commissionAccrualIds: accrualRefs.map((r) => r.id),
        receiptNo,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: ctx.uid,
      });

      for (const [productId, qty] of productDecrements) {
        tx.update(tenantRoot.collection('products').doc(productId), { mevcutStok: FieldValue.increment(-qty) });
      }
      for (const [packageId, qty] of packageDecrements) {
        tx.update(tenantRoot.collection('customerPackages').doc(packageId), { kalanSeans: FieldValue.increment(-qty) });
      }

      if (data.appointmentId) {
        tx.update(tenantRoot.collection('appointments').doc(data.appointmentId), {
          status: 'Tamamlandı',
          sessionId: sessionRef.id,
        });
      }

      return { sessionId: sessionRef.id, receiptNo, totalAmount };
    });

    await writeAuditLog({
      tenantId: ctx.tenantId,
      entity: 'sessions',
      action: 'callable',
      entityId: result.sessionId,
      after: { receiptNo: result.receiptNo, totalAmount: result.totalAmount },
      actor: ctx,
    });

    res.json(result);
  }),
);
