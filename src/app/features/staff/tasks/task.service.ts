import { Injectable, Signal } from '@angular/core';
import { ApiCrudService } from '../../../core/services/api-crud.service';
import { StaffTask } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class TaskService extends ApiCrudService<StaffTask> {
  constructor() {
    super('/spa/tasks');
  }

  watchRecentSignal(count: Signal<number>) {
    return this.watchWindowSignal(count);
  }
}
