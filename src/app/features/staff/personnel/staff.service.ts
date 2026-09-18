import { Injectable } from '@angular/core';
import { orderBy } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { Staff } from '../../../core/models';

/** Doc id == Firebase Auth uid; created by the `createTenant`/`inviteStaffUser` callables. */
@Injectable({ providedIn: 'root' })
export class StaffService extends FirestoreCrudService<Staff> {
  constructor() {
    super('staff');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('ad', 'asc'));
  }
}
