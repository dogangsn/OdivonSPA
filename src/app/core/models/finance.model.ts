import { FirestoreDate, PaymentMethod } from './common.model';

/** Seans dışı ödeme kayıtları + iadeler. Never hard-deleted — refunds are reversing entries. */
export interface Payment {
  customerId?: string;
  method: PaymentMethod;
  amount: number; // negative for refunds
  note?: string;
  isRefund: boolean;
  originalPaymentId?: string;
  createdAt: FirestoreDate;
  createdBy: string;
}

export type CommissionRuleScope = 'staff' | 'serviceType' | 'service';
export type CommissionRuleType = 'percent' | 'fixed';

export interface CommissionRule {
  scope: CommissionRuleScope;
  refId: string; // staffId, serviceType tag, or serviceId depending on scope
  type: CommissionRuleType;
  value: number; // percent (0-100) or fixed TL amount
  priority: number; // lower number wins when multiple rules match (service > serviceType > staff-default)
  active: boolean;
}

export type CommissionAccrualStatus = 'pending' | 'paid' | 'cancelled';

export interface CommissionAccrual {
  staffId: string;
  sessionId: string;
  amount: number;
  status: CommissionAccrualStatus;
  date: FirestoreDate;
  payoutId?: string;
}

export interface CommissionPayout {
  staffId: string;
  accrualIds: string[];
  totalAmount: number;
  expenseId: string;
  createdAt: FirestoreDate;
  createdBy: string;
}

export type ExpenseCategory = 'maas' | 'prim' | 'avans' | 'genel';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  maas: 'Maaş',
  prim: 'Prim',
  avans: 'Avans',
  genel: 'Genel',
};

export interface Expense {
  kategori: ExpenseCategory;
  amount: number;
  staffId?: string;
  note?: string;
  date: FirestoreDate;
  createdAt: FirestoreDate;
  createdBy: string;
}

export type CashRegisterDayStatus = 'open' | 'closed';

export interface CashRegisterReopenEntry {
  at: FirestoreDate;
  by: string;
  reason?: string;
}

/** Doc id is the date in `YYYY-MM-DD` form. Written by closeCashRegisterDay/reopenCashRegisterDay callables. */
export interface CashRegisterDay {
  date: string;
  status: CashRegisterDayStatus;
  totalsByMethod: Partial<Record<PaymentMethod, number>>;
  totalIncome: number;
  totalExpense: number;
  totalCommission: number;
  netCash: number;
  closedAt?: FirestoreDate;
  closedBy?: string;
  reopenHistory: CashRegisterReopenEntry[];
}
