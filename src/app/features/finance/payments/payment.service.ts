import { Injectable, Signal } from '@angular/core';
import { ApiCrudService } from '../../../core/services/api-crud.service';
import { Payment } from '../../../core/models';

/** Payments are never edited or deleted — refunds are reversing entries created by the server. */
@Injectable({ providedIn: 'root' })
export class PaymentService extends ApiCrudService<Payment> {
  constructor() {
    super('/spa/payments');
  }

  watchByCustomer(customerId: string) {
    return this.watchAll({ customerId });
  }

  watchByDateRange(start: Date, end: Date) {
    return this.watchAll({ from: start, to: end });
  }

  async createManualPayment(input: { customerId?: string; method: Payment['method']; amount: number; note?: string }): Promise<void> {
    await this.command(this.api.post(this.path, input));
  }

  async refund(paymentId: string, reason?: string): Promise<void> {
    await this.command(this.api.post(`${this.path}/${paymentId}/refund`, { reason }));
  }

  watchRecentSignal(count: Signal<number>) {
    return this.watchWindowSignal(count);
  }
}
