import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { db, FieldValue } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';

type PaymentMethod = 'nakit' | 'kart' | 'havale' | 'diger';

interface SellPackageData {
  customerId: string;
  packagePlanId: string;
  payments: { method: PaymentMethod; amount: number }[];
}

/** Sells a package and records the money in `payments` so cash register/reports include it. */
export const sellPackage = onCall<SellPackageData>({ region: 'europe-west1' }, async (request) => {
  const ctx = requireTenantAuth(request, ['admin', 'reception']);
  const { customerId, packagePlanId, payments } = request.data ?? {};
  if (!customerId || !packagePlanId || !payments?.length) {
    throw new HttpsError('invalid-argument', 'Müşteri, paket planı ve ödeme zorunludur.');
  }

  const root = db.collection('tenants').doc(ctx.tenantId);

  const result = await db.runTransaction(async (tx) => {
    const [planSnap, customerSnap] = await Promise.all([
      tx.get(root.collection('packagePlans').doc(packagePlanId)),
      tx.get(root.collection('customers').doc(customerId)),
    ]);
    if (!planSnap.exists) throw new HttpsError('not-found', 'Paket planı bulunamadı.');
    if (!customerSnap.exists) throw new HttpsError('not-found', 'Müşteri bulunamadı.');

    const plan = planSnap.data() as { fiyat: number; seansAdedi: number; gecerlilikGunu: number; ad: string; active: boolean };
    if (!plan.active) throw new HttpsError('failed-precondition', 'Paket planı aktif değil.');

    const paid = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
    if (Math.abs(paid - plan.fiyat) > 0.01) {
      throw new HttpsError('failed-precondition', 'Ödeme tutarı paket fiyatına eşit olmalı.');
    }

    const now = new Date();
    const expires = new Date(now.getTime() + plan.gecerlilikGunu * 24 * 60 * 60 * 1000);
    const packageRef = root.collection('customerPackages').doc();

    tx.set(packageRef, {
      customerId,
      packagePlanId,
      toplamSeans: plan.seansAdedi,
      kalanSeans: plan.seansAdedi,
      satisTarihi: Timestamp.fromDate(now),
      bitisTarihi: Timestamp.fromDate(expires),
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: ctx.uid,
    });

    for (const payment of payments) {
      if (payment.amount <= 0) continue;
      tx.set(root.collection('payments').doc(), {
        customerId,
        method: payment.method,
        amount: payment.amount,
        note: `Paket satışı: ${plan.ad}`,
        isRefund: false,
        customerPackageId: packageRef.id,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: ctx.uid,
      });
    }

    return { customerPackageId: packageRef.id };
  });

  await writeAuditLog({
    tenantId: ctx.tenantId,
    entity: 'customerPackages',
    action: 'callable',
    entityId: result.customerPackageId,
    after: { customerId, packagePlanId },
    actor: ctx,
  });

  return result;
});
