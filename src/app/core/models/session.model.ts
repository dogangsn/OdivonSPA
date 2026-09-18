import { FirestoreDate, PaymentMethod } from './common.model';

export type SessionItemKind = 'service' | 'product';

export interface SessionItem {
  kind: SessionItemKind;
  refId: string; // serviceId or productId
  ad: string; // snapshot of name at time of sale
  qty: number;
  price: number; // unit price at time of sale
  discount: number;
  customerPackageId?: string; // set when redeemed from a package instead of charged
}

export interface SessionPayment {
  method: PaymentMethod;
  amount: number;
}

/** Written exclusively by the `checkoutSession` callable — never created directly from the client. */
export interface Session {
  appointmentId?: string;
  customerId: string;
  staffId: string;
  roomId: string;
  items: SessionItem[];
  totalAmount: number;
  discountAmount: number;
  payments: SessionPayment[];
  commissionAccrualIds: string[];
  receiptNo: string;
  createdAt: FirestoreDate;
  createdBy: string;
}
