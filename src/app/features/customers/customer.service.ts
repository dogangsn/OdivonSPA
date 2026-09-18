import { Injectable } from '@angular/core';
import { orderBy } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../core/services/firestore-crud.service';
import { Customer } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class CustomerService extends FirestoreCrudService<Customer> {
  constructor() {
    super('customers');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('createdAt', 'desc'));
  }
}
