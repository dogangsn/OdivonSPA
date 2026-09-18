import { Component, inject } from '@angular/core';
import { KpiCard } from '../../core/ui/kpi-card/kpi-card';
import { AuthService } from '../../core/auth/auth.service';
import { CustomerService } from '../customers/customer.service';

@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [KpiCard],
  templateUrl: './panel.html',
})
export class Panel {
  private readonly customerService = inject(CustomerService);
  readonly auth = inject(AuthService);

  readonly customers = this.customerService.watchAllSignal();
}
