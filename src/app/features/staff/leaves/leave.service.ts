import { Injectable, Signal } from '@angular/core';
import { orderBy } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { StaffLeave } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class LeaveService extends FirestoreCrudService<StaffLeave> {
  constructor() {
    super('staffLeaves');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('startDate', 'desc'));
  }

  watchRecentSignal(count: Signal<number>) {
    return this.watchWindowSignal(count, orderBy('startDate', 'desc'));
  }
}
