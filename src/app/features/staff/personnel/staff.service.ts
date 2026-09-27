import { Injectable } from '@angular/core';
import { ApiCrudService } from '../../../core/services/api-crud.service';
import { Staff } from '../../../core/models';

/** Id == Firebase Auth uid; created by onboarding or staff invite (see StaffAdminService). */
@Injectable({ providedIn: 'root' })
export class StaffService extends ApiCrudService<Staff> {
  constructor() {
    super('/spa/staff');
  }
}
