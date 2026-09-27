import { Injectable } from '@angular/core';
import { ApiCrudService } from '../../../core/services/api-crud.service';
import { CashRegisterDay } from '../../../core/models';

/** Days are keyed by their `YYYY-MM-DD` date; a day with no record yet comes back as `status: 'open'`. */
@Injectable({ providedIn: 'root' })
export class CashRegisterDayService extends ApiCrudService<CashRegisterDay> {
  constructor() {
    super('/spa/cash-register-days');
  }

  /** Inclusive `YYYY-MM-DD` range. */
  watchRange(startDate: string, endDate: string) {
    return this.watchAll({ from: startDate, to: endDate });
  }

  async closeDay(date: string): Promise<{ date: string; netCash: number; totalIncome: number; totalExpense: number }> {
    return this.command(this.api.post(`${this.path}/${date}/close`));
  }

  async reopenDay(date: string, reason?: string): Promise<void> {
    await this.command(this.api.post(`${this.path}/${date}/reopen`, { reason }));
  }
}
