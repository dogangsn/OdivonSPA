import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Timestamp, orderBy, where } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { CommissionAccrual } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class CommissionAccrualService extends FirestoreCrudService<CommissionAccrual> {
  private readonly functions = inject(Functions);

  constructor() {
    super('commissionAccruals');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('date', 'desc'));
  }

  watchByDateRange(start: Date, end: Date) {
    return this.watchAll(where('date', '>=', Timestamp.fromDate(start)), where('date', '<', Timestamp.fromDate(end)), orderBy('date', 'desc'));
  }

  watchByStaff(staffId: string) {
    return this.watchAll(where('staffId', '==', staffId), orderBy('date', 'desc'));
  }

  async payout(staffId: string, accrualIds: string[]): Promise<{ payoutId: string; expenseId: string; totalAmount: number }> {
    const callable = httpsCallable<
      { staffId: string; accrualIds: string[] },
      { payoutId: string; expenseId: string; totalAmount: number }
    >(this.functions, 'payoutCommissions');
    const result = await callable({ staffId, accrualIds });
    return result.data;
  }
}
