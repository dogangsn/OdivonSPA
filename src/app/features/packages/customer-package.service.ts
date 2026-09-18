import { Injectable } from '@angular/core';
import { Timestamp, orderBy, where } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../core/services/firestore-crud.service';
import { CustomerPackage } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class CustomerPackageService extends FirestoreCrudService<CustomerPackage> {
  constructor() {
    super('customerPackages');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('satisTarihi', 'desc'));
  }

  /** Active, unused packages for one customer — used by POS to offer "redeem from package" per line item. */
  watchActiveForCustomer(customerId: string) {
    return this.watchAll(where('customerId', '==', customerId), where('status', '==', 'active'));
  }

  watchSoldByDateRange(start: Date, end: Date) {
    return this.watchAll(
      where('satisTarihi', '>=', Timestamp.fromDate(start)),
      where('satisTarihi', '<', Timestamp.fromDate(end)),
      orderBy('satisTarihi', 'desc'),
    );
  }
}
