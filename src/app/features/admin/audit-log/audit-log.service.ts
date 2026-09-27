import { Injectable, Signal } from '@angular/core';
import { ApiCrudService } from '../../../core/services/api-crud.service';
import { AuditLog } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class AuditLogService extends ApiCrudService<AuditLog> {
  constructor() {
    super('/spa/audit-logs');
  }

  watchRecentSignal(count: Signal<number>) {
    return this.watchWindowSignal(count);
  }
}
