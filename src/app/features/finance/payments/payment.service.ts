import { Injectable, inject } from '@angular/core';
import { Timestamp, orderBy, where } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { ApiService } from '../../../core/http/api.service';
import { Payment } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class PaymentService extends FirestoreCrudService<Payment> {
  private readonly api = inject(ApiService);

  constructor() {
    super('payments');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('createdAt', 'desc'));
  }

  watchByCustomer(customerId: string) {
    return this.watchAll(where('customerId', '==', customerId));
  }

  watchByDateRange(start: Date, end: Date) {
    return this.watchAll(
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<', Timestamp.fromDate(end)),
      orderBy('createdAt', 'desc'),
    );
  }

  async createManualPayment(input: { customerId?: string; method: Payment['method']; amount: number; note?: string }): Promise<void> {
    await this.create({ ...input, isRefund: false } as Omit<Payment, 'id'>);
  }

  async refund(paymentId: string, reason?: string): Promise<void> {
    await this.api.post<{ refundId: string }>(`/api/payments/${paymentId}/refund`, { reason });
  }
}
