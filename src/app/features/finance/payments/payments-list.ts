import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { EmptyState } from '../../../core/ui/empty-state/empty-state';
import { FirestoreDatePipe } from '../../../core/pipes/firestore-date.pipe';
import { SlideOverDrawer } from '../../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge } from '../../../core/ui/status-badge/status-badge';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '../../../core/models';
import { PaymentService } from './payment.service';
import { CustomerService } from '../../customers/customer.service';

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
  imports: [FormsModule, DecimalPipe, FirestoreDatePipe, MatIconModule, EmptyState, SlideOverDrawer, StatusBadge],
  templateUrl: './payments-list.html',
})
export class PaymentsList {
  private readonly paymentService = inject(PaymentService);
  private readonly confirmService = inject(ConfirmService);
  private readonly customerService = inject(CustomerService);

  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  readonly paymentMethods: PaymentMethod[] = ['nakit', 'kart', 'havale', 'diger'];

  readonly payments = this.paymentService.watchAllSignal();
  readonly customers = this.customerService.watchAllSignal();
  readonly customerNameById = computed(() => new Map(this.customers().map((c) => [c.id, c.ad])));

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
