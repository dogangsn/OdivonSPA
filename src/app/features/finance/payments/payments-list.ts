import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { EmptyState } from '../../../core/ui/empty-state/empty-state';
import { KpiCard } from '../../../core/ui/kpi-card/kpi-card';
import { FirestoreDatePipe } from '../../../core/pipes/firestore-date.pipe';
import { SlideOverDrawer } from '../../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge } from '../../../core/ui/status-badge/status-badge';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '../../../core/models';
import { PaymentService } from './payment.service';
import { CustomerService } from '../../customers/customer.service';
import { ListWindow, LoadMore } from '../../../core/ui/load-more/load-more';

interface PaymentForm {
  customerId: string;
  method: PaymentMethod;
  amount: number;
  note: string;
}

const EMPTY_FORM: PaymentForm = { customerId: '', method: 'nakit', amount: 0, note: '' };

@Component({
  selector: 'app-payments-list',
  standalone: true,
  imports: [KpiCard, FormsModule, DecimalPipe, FirestoreDatePipe, MatIconModule, EmptyState, SlideOverDrawer, StatusBadge, LoadMore],
  templateUrl: './payments-list.html',
})
export class PaymentsList {
  private readonly paymentService = inject(PaymentService);
  private readonly confirmService = inject(ConfirmService);
  private readonly customerService = inject(CustomerService);

  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  readonly paymentMethods: PaymentMethod[] = ['nakit', 'kart', 'havale', 'diger'];

  readonly listWindow = new ListWindow();
  readonly payments = this.paymentService.watchRecentSignal(this.listWindow.count);
  readonly hasMore = this.listWindow.hasMore(this.payments);
  readonly customers = this.customerService.watchAllSignal();
  readonly customerNameById = computed(() => new Map(this.customers().map((c) => [c.id, c.ad])));

  readonly searchQuery = signal('');
  readonly filteredPayments = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.payments();
    const names = this.customerNameById();
    return this.payments().filter(
      (p) =>
        (p.customerId ? names.get(p.customerId) ?? '' : '').toLowerCase().includes(query) ||
        this.paymentMethodLabels[p.method].toLowerCase().includes(query) ||
        (p.note ?? '').toLowerCase().includes(query),
    );
  });
  readonly totals = computed(() => {
    let income = 0;
    let refund = 0;
    let cash = 0;
    let incomeCount = 0;
    let refundCount = 0;
    for (const p of this.filteredPayments()) {
      if (p.amount < 0) {
        refund += -p.amount;
        refundCount++;
      } else {
        income += p.amount;
        incomeCount++;
        if (p.method === 'nakit') cash += p.amount;
      }
    }
    return {
      income,
      refund,
      net: income - refund,
      incomeCount,
      refundCount,
      cashShare: income ? Math.round((cash / income) * 100) : 0,
    };
  });

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }
  /** Payments that already have a refund — older refunds predate `refundId`, so derive it from the refund rows too. */
  readonly refundedIds = computed(
    () => new Set(this.payments().flatMap((p) => [p.isRefund ? p.originalPaymentId : undefined, p.refundId ? p.id : undefined]).filter(Boolean)),
  );

  readonly drawerOpen = signal(false);
  readonly saving = signal(false);
  form: PaymentForm = { ...EMPTY_FORM };

  openCreateDrawer(): void {
    this.form = { ...EMPTY_FORM };
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  async save(): Promise<void> {
    if (this.form.amount <= 0) return;
    this.saving.set(true);
    try {
      await this.paymentService.createManualPayment({
        customerId: this.form.customerId || undefined,
        method: this.form.method,
        amount: this.form.amount,
        note: this.form.note.trim() || undefined,
      });
      this.closeDrawer();
      await this.confirmService.toastSuccess('Ödeme kaydedildi');
    } catch (err) {
      await this.confirmService.error('Ödeme Kaydedilemedi', err instanceof Error ? err.message : undefined);
    } finally {
      this.saving.set(false);
    }
  }

  async refund(paymentId: string): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: 'Ödemeyi İade Et',
      text: 'Orijinal kayıt silinmez, negatif tutarlı ters kayıt oluşturulur.',
      danger: true,
      confirmText: 'İade Et',
    });
    if (!confirmed) return;
    try {
      await this.paymentService.refund(paymentId);
    } catch (err) {
      await this.confirmService.error('İade Yapılamadı', err instanceof Error ? err.message : undefined);
    }
  }
}
