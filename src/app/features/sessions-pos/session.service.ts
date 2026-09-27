import { Injectable, Signal } from '@angular/core';
import { ApiCrudService } from '../../core/services/api-crud.service';
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

/** Sessions (POS sales) are only ever created by the server-side checkout. */
@Injectable({ providedIn: 'root' })
export class SessionService extends ApiCrudService<Session> {
  constructor() {
    super('/spa/sessions');
  }

  watchByCustomer(customerId: string) {
    return this.watchAll({ customerId });
  }

  watchByDateRange(start: Date, end: Date) {
    return this.watchAll({ from: start, to: end });
  }

  async checkout(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    return this.command(this.api.post<CheckoutSessionResult>(`${this.path}/checkout`, input));
  }

  watchRecentSignal(count: Signal<number>) {
    return this.watchWindowSignal(count);
  }
}
