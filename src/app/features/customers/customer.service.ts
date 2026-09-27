import { Injectable } from '@angular/core';
import { ApiCrudService } from '../../core/services/api-crud.service';
import { Customer } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class CustomerService extends ApiCrudService<Customer> {
  constructor() {
    super('/spa/customers');
  }
}
