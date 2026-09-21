import { Injectable, inject } from '@angular/core';
import { Timestamp, orderBy, where } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../core/services/firestore-crud.service';
import { ApiService } from '../../core/http/api.service';
import { CustomerPackage, PaymentMethod } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class CustomerPackageService extends FirestoreCrudService<CustomerPackage> {
  private readonly api = inject(ApiService);

  constructor() {
    super('customerPackages');
  }

  async sell(input: { customerId: string; packagePlanId: string; payments: { method: PaymentMethod; amount: number }[] }) {
    return this.api.post<{ customerPackageId: string }>('/api/packages/sell', input);
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('satisTarihi', 'desc'));
  }

  /** Active, unused packages for one customer — used by POS to offer "redeem from package" per line item. */
  watchActiveForCustomer(customerId: string) {
    return this.watchAll(where('customerId', '==', customerId), where('status', '==', 'active'));
  }

  watchByCustomer(customerId: string) {
    return this.watchAll(where('customerId', '==', customerId));
  }

  watchSoldByDateRange(start: Date, end: Date) {
    return this.watchAll(
      where('satisTarihi', '>=', Timestamp.fromDate(start)),
      where('satisTarihi', '<', Timestamp.fromDate(end)),
      orderBy('satisTarihi', 'desc'),
    );
  }
}
