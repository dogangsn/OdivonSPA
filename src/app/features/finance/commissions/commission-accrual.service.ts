import { Injectable, inject } from '@angular/core';
import { Timestamp, orderBy, where } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { ApiService } from '../../../core/http/api.service';
import { CommissionAccrual } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class CommissionAccrualService extends FirestoreCrudService<CommissionAccrual> {
  private readonly api = inject(ApiService);

  constructor() {
    super('commissionAccruals');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('date', 'desc'));
  }

  watchByDateRange(start: Date, end: Date) {
    return this.watchAll(where('date', '>=', Timestamp.fromDate(start)), where('date', '<', Timestamp.fromDate(end)), orderBy('date', 'desc'));
  }

  watchPending() {
    return this.watchAll(where('status', '==', 'pending'));
  }

  watchByStaff(staffId: string) {
    return this.watchAll(where('staffId', '==', staffId), orderBy('date', 'desc'));
  }

  async payout(staffId: string, accrualIds: string[]): Promise<{ payoutId: string; expenseId: string; totalAmount: number }> {
    return this.api.post('/api/commissions/payout', { staffId, accrualIds });
  }
}
