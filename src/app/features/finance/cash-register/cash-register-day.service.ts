import { Injectable, inject } from '@angular/core';
import { orderBy, where } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { ApiService } from '../../../core/http/api.service';
import { CashRegisterDay } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class CashRegisterDayService extends FirestoreCrudService<CashRegisterDay> {
  private readonly api = inject(ApiService);

  constructor() {
    super('cashRegisterDays');
  }

  watchRange(startDate: string, endDate: string) {
    return this.watchAll(where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date', 'asc'));
  }

  async closeDay(date: string): Promise<{ date: string; netCash: number; totalIncome: number; totalExpense: number }> {
    return this.api.post(`/api/cash-register-days/${date}/close`);
  }

  async reopenDay(date: string, reason?: string): Promise<void> {
    await this.api.post(`/api/cash-register-days/${date}/reopen`, { reason });
  }
}
