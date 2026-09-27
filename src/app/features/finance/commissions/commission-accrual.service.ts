import { Injectable } from '@angular/core';
import { ApiCrudService } from '../../../core/services/api-crud.service';
import { CommissionAccrual } from '../../../core/models';

/** Accruals are written by POS checkout only; admins list and pay them out here. */
@Injectable({ providedIn: 'root' })
export class CommissionAccrualService extends ApiCrudService<CommissionAccrual> {
  constructor() {
    super('/spa/commissions/accruals');
  }

  watchByDateRange(start: Date, end: Date) {
    return this.watchAll({ from: start, to: end });
  }

  watchPending() {
    return this.watchAll({ status: 'pending' });
  }

  watchByStaff(staffId: string) {
    return this.watchAll({ staffId });
  }

  async payout(staffId: string, accrualIds: string[]): Promise<{ payoutId: string; expenseId: string; totalAmount: number }> {
    return this.command(this.api.post('/spa/commissions/payout', { staffId, accrualIds }));
  }
}
