import { Injectable, inject } from '@angular/core';
import { Timestamp, orderBy, where } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../core/services/firestore-crud.service';
import { ApiService } from '../../core/http/api.service';
import { PaymentMethod, Session } from '../../core/models';

export interface CheckoutItemInput {
  kind: 'service' | 'product';
  refId: string;
  qty: number;
  discount?: number;
  customerPackageId?: string;
}

export interface CheckoutSessionInput {
  appointmentId?: string;
  customerId: string;
  staffId: string;
  roomId: string;
  items: CheckoutItemInput[];
  payments: { method: PaymentMethod; amount: number }[];
  discountAmount?: number;
}

export interface CheckoutSessionResult {
  sessionId: string;
  receiptNo: string;
  totalAmount: number;
}

/** Sessions (POS sales) are read directly from Firestore but only ever created via the `checkoutSession` callable. */
@Injectable({ providedIn: 'root' })
export class SessionService extends FirestoreCrudService<Session> {
  private readonly api = inject(ApiService);

  constructor() {
    super('sessions');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('createdAt', 'desc'));
  }

  /** No orderBy on purpose: avoids a composite index; callers sort client-side. */
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

  async checkout(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    return this.api.post<CheckoutSessionResult>('/api/pos/checkout-session', input);
  }
}
