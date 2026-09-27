import { Injectable, Signal } from '@angular/core';
import { ApiCrudService } from '../../../core/services/api-crud.service';
import { Expense } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class ExpenseService extends ApiCrudService<Expense> {
  constructor() {
    super('/spa/expenses');
  }

  watchByDateRange(start: Date, end: Date) {
    return this.watchAll({ from: start, to: end });
  }

  watchRecentSignal(count: Signal<number>) {
    return this.watchWindowSignal(count);
  }
}
