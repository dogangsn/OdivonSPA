import { Injectable } from '@angular/core';
import { ApiCrudService } from '../../../core/services/api-crud.service';
import { CommissionRule } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class CommissionRuleService extends ApiCrudService<CommissionRule> {
  constructor() {
    super('/spa/commissions/rules');
  }
}
