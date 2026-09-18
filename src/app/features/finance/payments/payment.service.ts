import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Timestamp, orderBy, where } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { Payment } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class PaymentService extends FirestoreCrudService<Payment> {
  private readonly functions = inject(Functions);

  constructor() {
    super('payments');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('createdAt', 'desc'));
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
    const callable = httpsCallable<{ paymentId: string; reason?: string }, { refundId: string }>(this.functions, 'refundPayment');
    await callable({ paymentId, reason });
  }
}
