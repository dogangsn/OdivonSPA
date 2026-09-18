import { Component, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { StatusBadge } from '../../core/ui/status-badge/status-badge';
import { CustomerService } from './customer.service';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [RouterLink, MatIconModule, StatusBadge],
  templateUrl: './customer-detail.html',
})
export class CustomerDetail {
  private readonly customerService = inject(CustomerService);

  readonly id = input.required<string>();

  readonly customer = toSignal(
    toObservable(this.id).pipe(switchMap((id) => this.customerService.watchOne(id))),
    { initialValue: undefined },
  );
}
