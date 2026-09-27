import { Injectable, Signal } from '@angular/core';
import { ApiCrudService } from '../../../core/services/api-crud.service';
import { StaffLeave } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class LeaveService extends ApiCrudService<StaffLeave> {
  constructor() {
    super('/spa/leaves');
  }

  watchRecentSignal(count: Signal<number>) {
    return this.watchWindowSignal(count);
  }
}
