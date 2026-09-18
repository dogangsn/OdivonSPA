import { Injectable } from '@angular/core';
import { orderBy } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { CommissionRule } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class CommissionRuleService extends FirestoreCrudService<CommissionRule> {
  constructor() {
    super('commissionRules');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('priority', 'asc'));
  }
}
