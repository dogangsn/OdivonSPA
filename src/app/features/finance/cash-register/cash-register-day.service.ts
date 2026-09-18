import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { orderBy, where } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { CashRegisterDay } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class CashRegisterDayService extends FirestoreCrudService<CashRegisterDay> {
  private readonly functions = inject(Functions);

  constructor() {
    super('cashRegisterDays');
  }

  watchRange(startDate: string, endDate: string) {
    return this.watchAll(where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date', 'asc'));
  }

  async closeDay(date: string): Promise<{ date: string; netCash: number; totalIncome: number; totalExpense: number }> {
    const callable = httpsCallable<{ date: string }, { date: string; netCash: number; totalIncome: number; totalExpense: number }>(
      this.functions,
      'closeCashRegisterDay',
    );
    const result = await callable({ date });
    return result.data;
  }

  async reopenDay(date: string, reason?: string): Promise<void> {
    const callable = httpsCallable<{ date: string; reason?: string }, { success: boolean }>(this.functions, 'reopenCashRegisterDay');
    await callable({ date, reason });
  }
}
