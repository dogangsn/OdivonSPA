import { Injectable } from '@angular/core';
import { orderBy } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../core/services/firestore-crud.service';
import { PackagePlan } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class PackagePlanService extends FirestoreCrudService<PackagePlan> {
  constructor() {
    super('packagePlans');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('ad', 'asc'));
  }
}
