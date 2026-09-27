"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkoutSession = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
const time_1 = require("../lib/time");
const commission_engine_1 = require("../commissions/commission-engine");
const EPSILON = 0.01;
exports.checkoutSession = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    const ctx = (0, context_1.requireTenantAuth)(request, ['admin', 'reception', 'therapist']);
    const data = request.data;
    if (!data?.customerId || !data?.staffId || !data?.roomId || !data.items?.length) {
        throw new https_1.HttpsError('invalid-argument', 'Müşteri, terapist, oda ve en az bir hizmet/ürün zorunludur.');
    }
    const tenantRoot = admin_1.db.collection('tenants').doc(ctx.tenantId);
    const globalDiscount = data.discountAmount ?? 0;
    const timeZone = await (0, time_1.getTenantTimezone)(ctx.tenantId);
    const result = await admin_1.db.runTransaction(async (tx) => {
        // ---- Reads ----
        const staffSnap = await tx.get(tenantRoot.collection('staff').doc(data.staffId));
        if (!staffSnap.exists)
            throw new https_1.HttpsError('not-found', 'Terapist bulunamadı.');
        const staffData = staffSnap.data();
        const serviceRefs = data.items.filter((i) => i.kind === 'service').map((i) => i.refId);
        const productRefs = data.items.filter((i) => i.kind === 'product').map((i) => i.refId);
        const packageRefs = data.items.filter((i) => i.customerPackageId).map((i) => i.customerPackageId);
        const serviceSnaps = await Promise.all(serviceRefs.map((id) => tx.get(tenantRoot.collection('services').doc(id))));
        const productSnaps = await Promise.all(productRefs.map((id) => tx.get(tenantRoot.collection('products').doc(id))));
        const packageSnaps = await Promise.all(packageRefs.map((id) => tx.get(tenantRoot.collection('customerPackages').doc(id))));
        const rulesSnap = await tx.get(tenantRoot.collection('commissionRules').where('active', '==', true));
        const servicesById = new Map(serviceSnaps.map((s) => [s.id, s.data()]));
        const productsById = new Map(productSnaps.map((s) => [s.id, s.data()]));
        const packagesById = new Map(packageSnaps.map((s) => [s.id, s]));
        const rules = rulesSnap.docs.map((d) => d.data());
        for (const id of serviceRefs) {
            if (!servicesById.get(id))
                throw new https_1.HttpsError('not-found', `Hizmet bulunamadı: ${id}`);
        }
        for (const id of productRefs) {
            if (!productsById.get(id))
                throw new https_1.HttpsError('not-found', `Ürün bulunamadı: ${id}`);
        }
        // ---- Resolve line items & validate stock/package balances ----
        let totalAmount = 0;
        const resolvedItems = [];
        const commissionLines = [];
        const productDecrements = new Map();
        const packageDecrements = new Map();
        for (const item of data.items) {
            const discount = item.discount ?? 0;
            if (item.kind === 'service') {
                const service = servicesById.get(item.refId);
                const lineBasis = service.fiyat * item.qty;
                const isPackageRedemption = !!item.customerPackageId;
                if (isPackageRedemption) {
                    const pkgSnap = packagesById.get(item.customerPackageId);
                    const pkg = pkgSnap?.data();
                    if (!pkgSnap?.exists || !pkg)
                        throw new https_1.HttpsError('not-found', 'Paket bulunamadı.');
                    if (pkg.customerId !== data.customerId)
                        throw new https_1.HttpsError('failed-precondition', 'Paket bu müşteriye ait değil.');
                    if (pkg.status !== 'active')
                        throw new https_1.HttpsError('failed-precondition', 'Paket aktif değil.');
                    if (pkg.kalanSeans < item.qty)
                        throw new https_1.HttpsError('failed-precondition', 'Paketin kalan seans hakkı yetersiz.');
                    packageDecrements.set(item.customerPackageId, (packageDecrements.get(item.customerPackageId) ?? 0) + item.qty);
                }
                else {
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
                const commission = (0, commission_engine_1.resolveCommissionAmount)({
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
            }
            else {
                const product = productsById.get(item.refId);
                if (product.mevcutStok < item.qty) {
                    throw new https_1.HttpsError('failed-precondition', `"${product.ad}" için stok yetersiz.`);
                }
                totalAmount += product.fiyat * item.qty - discount;
                productDecrements.set(item.refId, (productDecrements.get(item.refId) ?? 0) + item.qty);
                resolvedItems.push({ kind: 'product', refId: item.refId, ad: product.ad, qty: item.qty, price: product.fiyat, discount });
            }
        }
        totalAmount = round2(totalAmount - globalDiscount);
        const paymentsTotal = round2((data.payments ?? []).reduce((sum, p) => sum + p.amount, 0));
        if (Math.abs(paymentsTotal - totalAmount) > EPSILON) {
            throw new https_1.HttpsError('failed-precondition', 'Ödeme tutarları toplamı seans tutarına eşit olmalı.');
        }
        // ---- Sequential receipt number ----
        const counterRef = tenantRoot.collection('counters').doc('sessions');
        const counterSnap = await tx.get(counterRef);
        const nextSeq = (counterSnap.data()?.['value'] ?? 0) + 1;
        const receiptNo = `S-${(0, time_1.dateStampInTz)(timeZone)}-${String(nextSeq).padStart(4, '0')}`;
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
                date: admin_1.FieldValue.serverTimestamp(),
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
            createdAt: admin_1.FieldValue.serverTimestamp(),
            createdBy: ctx.uid,
        });
        for (const [productId, qty] of productDecrements) {
            tx.update(tenantRoot.collection('products').doc(productId), { mevcutStok: admin_1.FieldValue.increment(-qty) });
        }
        for (const [packageId, qty] of packageDecrements) {
            tx.update(tenantRoot.collection('customerPackages').doc(packageId), { kalanSeans: admin_1.FieldValue.increment(-qty) });
        }
        if (data.appointmentId) {
            tx.update(tenantRoot.collection('appointments').doc(data.appointmentId), {
                status: 'Tamamlandı',
                sessionId: sessionRef.id,
            });
        }
        return { sessionId: sessionRef.id, receiptNo, totalAmount };
    });
    await (0, audit_1.writeAuditLog)({
        tenantId: ctx.tenantId,
        entity: 'sessions',
        action: 'callable',
        entityId: result.sessionId,
        after: { receiptNo: result.receiptNo, totalAmount: result.totalAmount },
        actor: ctx,
    });
    return result;
});
function round2(value) {
    return Math.round(value * 100) / 100;
}
//# sourceMappingURL=checkout-session.js.map