import { Injectable } from '@angular/core';
import { ApiCrudService } from '../../core/services/api-crud.service';
import { PackagePlan } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class PackagePlanService extends ApiCrudService<PackagePlan> {
  constructor() {
    super('/spa/package-plans');
  }
}
