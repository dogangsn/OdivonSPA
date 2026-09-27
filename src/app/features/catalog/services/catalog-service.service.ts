import { Injectable } from '@angular/core';
import { ApiCrudService } from '../../../core/services/api-crud.service';
import { Service } from '../../../core/models';

/** Named CatalogServiceService (not ServiceService) to avoid the confusing "Service" x2 stutter. */
@Injectable({ providedIn: 'root' })
export class CatalogServiceService extends ApiCrudService<Service> {
  constructor() {
    super('/spa/services');
  }
}
