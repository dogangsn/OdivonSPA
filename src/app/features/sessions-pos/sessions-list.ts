import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { EmptyState } from '../../core/ui/empty-state/empty-state';
import { FirestoreDatePipe } from '../../core/pipes/firestore-date.pipe';
import { PAYMENT_METHOD_LABELS } from '../../core/models';
import { SessionService } from './session.service';
import { CustomerService } from '../customers/customer.service';
import { StaffService } from '../staff/personnel/staff.service';

@Component({
  selector: 'app-sessions-list',
  standalone: true,
  imports: [RouterLink, DecimalPipe, FirestoreDatePipe, MatIconModule, EmptyState],
  templateUrl: './sessions-list.html',
})
export class SessionsList {
  private readonly sessionService = inject(SessionService);
  private readonly customerService = inject(CustomerService);
  private readonly staffService = inject(StaffService);

  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  readonly sessions = this.sessionService.watchAllSignal();
  private readonly customers = this.customerService.watchAllSignal();
  private readonly staff = this.staffService.watchAllSignal();

  readonly customerNameById = computed(() => new Map(this.customers().map((c) => [c.id, c.ad])));
  readonly staffNameById = computed(() => new Map(this.staff().map((s) => [s.id, s.ad])));
}
