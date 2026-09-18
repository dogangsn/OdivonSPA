import { Injectable } from '@angular/core';
import { orderBy } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { StaffTask } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class TaskService extends FirestoreCrudService<StaffTask> {
  constructor() {
    super('tasks');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('createdAt', 'desc'));
  }
}
