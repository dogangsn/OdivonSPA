import { Router } from 'express';
import { db, FieldValue } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';
import { dateStampInTz, getTenantTimezone } from '../lib/time';
import { CommissionRuleRecord, resolveCommissionAmount } from '../commissions/commission-engine';
import { ApiError, asyncHandler } from '../lib/errors';

export const posRouter = Router();

type PaymentMethod = 'nakit' | 'kart' | 'havale' | 'diger';

interface CheckoutItemInput {
  kind: 'service' | 'product';
  refId: string;
  qty: number;
  discount?: number;
  customerPackageId?: string; // when redeeming instead of charging
}

interface CheckoutSessionBody {
  appointmentId?: string;
  customerId: string;
  staffId: string;
  roomId: string;
  items: CheckoutItemInput[];
  payments: { method: PaymentMethod; amount: number }[];
  discountAmount?: number;
}

const EPSILON = 0.01;

posRouter.post(
  '/pos/checkout-session',
  asyncHandler(async (req, res) => {
    const ctx = requireTenantAuth(req, ['admin', 'reception', 'therapist']);
    const data = req.body as CheckoutSessionBody;

    if (!data?.customerId || !data?.staffId || !data?.roomId || !data.items?.length) {
      throw new ApiError('invalid-argument', 'Müşteri, terapist, oda ve en az bir hizmet/ürün zorunludur.');
    }

    const tenantRoot = db.collection('tenants').doc(ctx.tenantId);
    const globalDiscount = data.discountAmount ?? 0;
    const timeZone = await getTenantTimezone(ctx.tenantId);

    const result = await db.runTransaction(async (tx) => {
      // ---- Reads ----
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

      const servicesById = new Map(serviceSnaps.map((s) => [s.id, s.data()]));
      const productsById = new Map(productSnaps.map((s) => [s.id, s.data()]));
      const packagesById = new Map(packageSnaps.map((s) => [s.id, s]));
      const rules = rulesSnap.docs.map((d) => d.data() as CommissionRuleRecord);

      for (const id of serviceRefs) {
        if (!servicesById.get(id)) throw new ApiError('not-found', `Hizmet bulunamadı: ${id}`);
      }
      for (const id of productRefs) {
        if (!productsById.get(id)) throw new ApiError('not-found', `Ürün bulunamadı: ${id}`);
      }

      // ---- Resolve line items & validate stock/package balances ----
      let totalAmount = 0;
      const resolvedItems: Record<string, unknown>[] = [];
      const commissionLines: { staffId: string; amount: number }[] = [];
      const productDecrements = new Map<string, number>();
      const packageDecrements = new Map<string, number>();

      for (const item of data.items) {
        const discount = item.discount ?? 0;

        if (item.kind === 'service') {
          const service = servicesById.get(item.refId) as { ad: string; fiyat: number; tur: string };
          const lineBasis = service.fiyat * item.qty;
          const isPackageRedemption = !!item.customerPackageId;

          if (isPackageRedemption) {
            const pkgSnap = packagesById.get(item.customerPackageId!);
            const pkg = pkgSnap?.data() as { customerId: string; kalanSeans: number; status: string } | undefined;
            if (!pkgSnap?.exists || !pkg) throw new ApiError('not-found', 'Paket bulunamadı.');
            if (pkg.customerId !== data.customerId) throw new ApiError('failed-precondition', 'Paket bu müşteriye ait değil.');
            if (pkg.status !== 'active') throw new ApiError('failed-precondition', 'Paket aktif değil.');
            if (pkg.kalanSeans < item.qty) throw new ApiError('failed-precondition', 'Paketin kalan seans hakkı yetersiz.');
            packageDecrements.set(item.customerPackageId!, (packageDecrements.get(item.customerPackageId!) ?? 0) + item.qty);
          } else {
            totalAmount += lineBasis - discount;
          }

          resolvedItems.push({
            kind: 'service',
            refId: item.refId,
            ad: service.ad,
            qty: item.qty,
            price: service.fiyat,
            discount,
            customerPackageId: item.customerPackageId ?? null,
          });

          const commission = resolveCommissionAmount({
            serviceId: item.refId,
            serviceType: service.tur,
            staffId: data.staffId,
            basisAmount: lineBasis,
            rules,
            staffDefaultPercent: staffData.primOraniVarsayilan ?? 0,
          });
          if (commission > 0) {
            commissionLines.push({ staffId: data.staffId, amount: commission });
          }
        } else {
          const product = productsById.get(item.refId) as { ad: string; fiyat: number; mevcutStok: number };
          if (product.mevcutStok < item.qty) {
            throw new ApiError('failed-precondition', `"${product.ad}" için stok yetersiz.`);
          }
          totalAmount += product.fiyat * item.qty - discount;
          productDecrements.set(item.refId, (productDecrements.get(item.refId) ?? 0) + item.qty);
          resolvedItems.push({ kind: 'product', refId: item.refId, ad: product.ad, qty: item.qty, price: product.fiyat, discount });
        }
      }

      totalAmount = round2(totalAmount - globalDiscount);
      const paymentsTotal = round2((data.payments ?? []).reduce((sum, p) => sum + p.amount, 0));
      if (Math.abs(paymentsTotal - totalAmount) > EPSILON) {
        throw new ApiError('failed-precondition', 'Ödeme tutarları toplamı seans tutarına eşit olmalı.');
      }

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
        payments: data.payments,
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
