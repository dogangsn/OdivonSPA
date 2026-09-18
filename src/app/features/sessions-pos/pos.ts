import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ConfirmService } from '../../core/ui/confirm/confirm.service';
import { PAYMENT_METHOD_LABELS, PaymentMethod, WithId, CustomerPackage } from '../../core/models';
import { CatalogServiceService } from '../catalog/services/catalog-service.service';
import { ProductService } from '../catalog/products/product.service';
import { RoomService } from '../catalog/rooms/room.service';
import { StaffService } from '../staff/personnel/staff.service';
import { CustomerService } from '../customers/customer.service';
import { CustomerPackageService } from '../packages/customer-package.service';
import { CheckoutItemInput, SessionService } from './session.service';

interface CartLine {
  kind: 'service' | 'product';
  refId: string;
  ad: string;
  price: number;
  qty: number;
  discount: number;
  customerPackageId: string | null;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [FormsModule, DecimalPipe, MatIconModule],
  templateUrl: './pos.html',
})
export class Pos {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly customerPackageService = inject(CustomerPackageService);
  private readonly confirmService = inject(ConfirmService);

  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  readonly paymentMethods: PaymentMethod[] = ['nakit', 'kart', 'havale', 'diger'];

  readonly services = inject(CatalogServiceService).watchAllSignal();
  readonly products = inject(ProductService).watchAllSignal();
  readonly staff = inject(StaffService).watchAllSignal();
  readonly rooms = inject(RoomService).watchAllSignal();
  readonly customers = inject(CustomerService).watchAllSignal();

  readonly activeCategory = signal<'services' | 'products'>('services');

  readonly appointmentId = signal<string | null>(null);
  readonly customerId = signal('');
  readonly staffId = signal('');
  readonly roomId = signal('');

  readonly customerPackages = toSignal(
    toObservable(this.customerId).pipe(switchMap((id) => (id ? this.customerPackageService.watchActiveForCustomer(id) : []))),
    { initialValue: [] as WithId<CustomerPackage>[] },
  );

  readonly cart = signal<CartLine[]>([]);
  readonly globalDiscount = signal(0);

  readonly paymentRows = signal<{ method: PaymentMethod; amount: number }[]>([{ method: 'nakit', amount: 0 }]);

  readonly submitting = signal(false);

  readonly selectedStaff = computed(() => this.staff().find((s) => s.id === this.staffId()));

  readonly chargeableSubtotal = computed(() =>
    round2(this.cart().reduce((sum, line) => (line.customerPackageId ? sum : sum + line.price * line.qty - line.discount), 0)),
  );

  readonly total = computed(() => round2(Math.max(0, this.chargeableSubtotal() - this.globalDiscount())));

  readonly paymentsTotal = computed(() => round2(this.paymentRows().reduce((sum, p) => sum + (p.amount || 0), 0)));
  readonly remaining = computed(() => round2(this.total() - this.paymentsTotal()));

  readonly estimatedCommission = computed(() => {
    const rate = this.selectedStaff()?.primOraniVarsayilan ?? 0;
    const serviceBasis = this.cart()
      .filter((l) => l.kind === 'service')
      .reduce((sum, l) => sum + l.price * l.qty, 0);
    return round2((rate / 100) * serviceBasis);
  });

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    this.appointmentId.set(params.get('appointmentId'));
    this.customerId.set(params.get('customerId') ?? '');
    this.staffId.set(params.get('staffId') ?? '');
    this.roomId.set(params.get('roomId') ?? '');
  }

  /** Not service-specific — the cashier picks the right plan manually when redeeming. */
  readonly availablePackages = computed(() => this.customerPackages().filter((p) => p.kalanSeans > 0));

  addService(service: { id: string; ad: string; fiyat: number }): void {
    this.addLine('service', service.id, service.ad, service.fiyat);
  }

  addProduct(product: { id: string; ad: string; fiyat: number }): void {
    this.addLine('product', product.id, product.ad, product.fiyat);
  }

  private addLine(kind: 'service' | 'product', refId: string, ad: string, price: number): void {
    const existing = this.cart().find((l) => l.kind === kind && l.refId === refId && !l.customerPackageId);
    if (existing) {
      this.updateQty(this.cart().indexOf(existing), existing.qty + 1);
      return;
    }
    this.cart.set([...this.cart(), { kind, refId, ad, price, qty: 1, discount: 0, customerPackageId: null }]);
  }

  removeLine(index: number): void {
    this.cart.set(this.cart().filter((_, i) => i !== index));
  }

  updateQty(index: number, qty: number): void {
    if (qty < 1) return;
    this.cart.set(this.cart().map((l, i) => (i === index ? { ...l, qty } : l)));
  }

  updateDiscount(index: number, discount: number): void {
    this.cart.set(this.cart().map((l, i) => (i === index ? { ...l, discount: Math.max(0, discount) } : l)));
  }

  setLinePackage(index: number, customerPackageId: string): void {
    this.cart.set(this.cart().map((l, i) => (i === index ? { ...l, customerPackageId: customerPackageId || null } : l)));
  }

  clearCart(): void {
    this.cart.set([]);
  }

  addPaymentRow(): void {
    this.paymentRows.set([...this.paymentRows(), { method: 'kart', amount: this.remaining() }]);
  }

  removePaymentRow(index: number): void {
    this.paymentRows.set(this.paymentRows().filter((_, i) => i !== index));
  }

  updatePaymentAmount(index: number, amount: number): void {
    this.paymentRows.set(this.paymentRows().map((p, i) => (i === index ? { ...p, amount } : p)));
  }

  updatePaymentMethod(index: number, method: PaymentMethod): void {
    this.paymentRows.set(this.paymentRows().map((p, i) => (i === index ? { ...p, method } : p)));
  }

  fillRemainingIntoFirstPayment(): void {
    const rows = this.paymentRows();
    if (rows.length === 0) return;
    this.paymentRows.set(rows.map((p, i) => (i === 0 ? { ...p, amount: this.total() } : p)));
  }

  canCheckout(): boolean {
    return !!this.customerId() && !!this.staffId() && !!this.roomId() && this.cart().length > 0 && Math.abs(this.remaining()) < 0.01;
  }

  async checkout(): Promise<void> {
    if (!this.canCheckout()) return;
    this.submitting.set(true);
    try {
      const items: CheckoutItemInput[] = this.cart().map((l) => ({
        kind: l.kind,
        refId: l.refId,
        qty: l.qty,
        discount: l.discount,
        customerPackageId: l.customerPackageId ?? undefined,
      }));

      const result = await this.sessionService.checkout({
        appointmentId: this.appointmentId() ?? undefined,
        customerId: this.customerId(),
        staffId: this.staffId(),
        roomId: this.roomId(),
        items,
        payments: this.paymentRows().filter((p) => p.amount > 0),
        discountAmount: this.globalDiscount(),
      });

      await this.confirmService.success('Seans Tamamlandı', `Fiş No: ${result.receiptNo}`);
      this.clearCart();
      await this.router.navigate(['/seanslar']);
    } catch (err) {
      await this.confirmService.error('Seans Kaydedilemedi', err instanceof Error ? err.message : undefined);
    } finally {
      this.submitting.set(false);
    }
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
