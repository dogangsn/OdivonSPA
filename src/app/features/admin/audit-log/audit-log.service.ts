import { Injectable, Signal } from '@angular/core';
import { orderBy, limit } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { AuditLog } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class AuditLogService extends FirestoreCrudService<AuditLog> {
  constructor() {
    super('auditLogs');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('createdAt', 'desc'), limit(500));
  }

  watchRecentSignal(count: Signal<number>) {
    return this.watchWindowSignal(count, orderBy('createdAt', 'desc'));
  }
}
