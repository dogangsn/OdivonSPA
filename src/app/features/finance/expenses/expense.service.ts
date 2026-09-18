import { Injectable } from '@angular/core';
import { Timestamp, orderBy, where } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { Expense } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class ExpenseService extends FirestoreCrudService<Expense> {
  constructor() {
    super('expenses');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('date', 'desc'));
  }

  watchByDateRange(start: Date, end: Date) {
    return this.watchAll(where('date', '>=', Timestamp.fromDate(start)), where('date', '<', Timestamp.fromDate(end)), orderBy('date', 'desc'));
  }
}
