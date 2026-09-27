import { CommissionRuleRecord, resolveCommissionAmount } from '../commissions/commission-engine';
import { ApiError } from './errors';
import { PaymentMethod, round2 } from './validation';

export interface CheckoutItemInput {
  kind: 'service' | 'product';
  refId: string;
  qty: number;
  discount?: number;
  customerPackageId?: string; // when redeeming instead of charging
}

export interface ServiceRecord {
  ad: string;
  fiyat: number;
  tur: string;
}

export interface ProductRecord {
  ad: string;
  fiyat: number;
  mevcutStok: number;
}

export interface CustomerPackageRecord {
  customerId: string;
  kalanSeans: number;
  status: string;
  bitisTarihi?: { toMillis(): number };
}

export interface CheckoutPricingInput {
  customerId: string;
  staffId: string;
  staffDefaultPercent: number;
  items: CheckoutItemInput[];
  payments: { method: PaymentMethod; amount: number }[];
  globalDiscount: number;
  services: Map<string, ServiceRecord>;
  products: Map<string, ProductRecord>;
  packages: Map<string, CustomerPackageRecord>;
  rules: CommissionRuleRecord[];
  now: number;
}

export interface CheckoutPricing {
  totalAmount: number;
  resolvedItems: Record<string, unknown>[];
  commissionLines: { staffId: string; amount: number }[];
  productDecrements: Map<string, number>;
  packageDecrements: Map<string, number>;
}

const EPSILON = 0.01;

/**
 * Pure pricing step of a POS checkout: resolves each line against the catalog, checks stock and package
 * balances (summed across repeated lines), applies discounts, computes commissions and checks that the
 * payments add up to the total. Kept free of Firestore so the money math can be unit tested.
 */
export function priceCheckout(input: CheckoutPricingInput): CheckoutPricing {
  let totalAmount = 0;
  const resolvedItems: Record<string, unknown>[] = [];
  const commissionLines: { staffId: string; amount: number }[] = [];
  const productDecrements = new Map<string, number>();
  const packageDecrements = new Map<string, number>();

  for (const item of input.items) {
    const discount = item.discount ?? 0;

    if (item.kind === 'service') {
      const service = input.services.get(item.refId);
      if (!service) throw new ApiError('not-found', `Hizmet bulunamadı: ${item.refId}`);
      const lineBasis = service.fiyat * item.qty;

      if (item.customerPackageId) {
        const pkg = input.packages.get(item.customerPackageId);
        if (!pkg) throw new ApiError('not-found', 'Paket bulunamadı.');
        if (pkg.customerId !== input.customerId)
          throw new ApiError('failed-precondition', 'Paket bu müşteriye ait değil.');
        if (pkg.status !== 'active')
          throw new ApiError('failed-precondition', 'Paket aktif değil.');
        // The daily cron flips status to expired; don't let a missed run allow redeeming an expired package.
        if (pkg.bitisTarihi && pkg.bitisTarihi.toMillis() < input.now) {
          throw new ApiError('failed-precondition', 'Paketin süresi dolmuş.');
        }
        const alreadyRedeemed = packageDecrements.get(item.customerPackageId) ?? 0;
        if (pkg.kalanSeans < alreadyRedeemed + item.qty)
          throw new ApiError('failed-precondition', 'Paketin kalan seans hakkı yetersiz.');
        packageDecrements.set(item.customerPackageId, alreadyRedeemed + item.qty);
      } else {
        if (discount > lineBasis)
          throw new ApiError(
            'invalid-argument',
            `"${service.ad}" için indirim satır tutarını aşamaz.`,
          );
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
        staffId: input.staffId,
        basisAmount: lineBasis,
        rules: input.rules,
        staffDefaultPercent: input.staffDefaultPercent,
      });
      if (commission > 0) {
        commissionLines.push({ staffId: input.staffId, amount: commission });
      }
    } else {
      const product = input.products.get(item.refId);
      if (!product) throw new ApiError('not-found', `Ürün bulunamadı: ${item.refId}`);
      const alreadyTaken = productDecrements.get(item.refId) ?? 0;
      if (product.mevcutStok < alreadyTaken + item.qty) {
        throw new ApiError('failed-precondition', `"${product.ad}" için stok yetersiz.`);
      }
      const productLine = product.fiyat * item.qty;
      if (discount > productLine)
        throw new ApiError(
          'invalid-argument',
          `"${product.ad}" için indirim satır tutarını aşamaz.`,
        );
      totalAmount += productLine - discount;
      productDecrements.set(item.refId, alreadyTaken + item.qty);
      resolvedItems.push({
        kind: 'product',
        refId: item.refId,
        ad: product.ad,
        qty: item.qty,
        price: product.fiyat,
        discount,
      });
    }
  }

  if (input.globalDiscount > round2(totalAmount)) {
    throw new ApiError('invalid-argument', 'Genel indirim seans tutarını aşamaz.');
  }
  totalAmount = round2(totalAmount - input.globalDiscount);
  const paymentsTotal = round2(input.payments.reduce((sum, p) => sum + p.amount, 0));
  if (Math.abs(paymentsTotal - totalAmount) > EPSILON) {
    throw new ApiError(
      'failed-precondition',
      'Ödeme tutarları toplamı seans tutarına eşit olmalı.',
    );
  }

  return { totalAmount, resolvedItems, commissionLines, productDecrements, packageDecrements };
}
