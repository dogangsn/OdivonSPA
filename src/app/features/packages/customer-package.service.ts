import { Injectable, Signal } from '@angular/core';
import { ApiCrudService } from '../../core/services/api-crud.service';
import { CustomerPackage, PaymentMethod } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class CustomerPackageService extends ApiCrudService<CustomerPackage> {
  constructor() {
    super('/spa/customer-packages');
  }

  async sell(input: { customerId: string; packagePlanId: string; payments: { method: PaymentMethod; amount: number }[] }) {
    return this.command(this.api.post<{ customerPackageId: string }>(`${this.path}/sell`, input));
  }

  /** Active, unused packages for one customer — used by POS to offer "redeem from package" per line item. */
  watchActiveForCustomer(customerId: string) {
    return this.watchAll({ customerId, status: 'active' });
  }

  watchByCustomer(customerId: string) {
    return this.watchAll({ customerId });
  }

  watchSoldByDateRange(start: Date, end: Date) {
    return this.watchAll({ from: start, to: end });
  }

  watchRecentSignal(count: Signal<number>) {
    return this.watchWindowSignal(count);
  }
}
