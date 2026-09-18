import { Injectable } from '@angular/core';
import { orderBy } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { Service } from '../../../core/models';

/** Named CatalogServiceService (not ServiceService) to avoid the confusing "Service" x2 stutter. */
@Injectable({ providedIn: 'root' })
export class CatalogServiceService extends FirestoreCrudService<Service> {
  constructor() {
    super('services');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('ad', 'asc'));
  }
}
