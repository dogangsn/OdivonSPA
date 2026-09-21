import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { StatusBadge } from '../../core/ui/status-badge/status-badge';
import { FirestoreDatePipe } from '../../core/pipes/firestore-date.pipe';
import { FirestoreDate, PAYMENT_METHOD_LABELS } from '../../core/models';
import { CustomerService } from './customer.service';
import { SessionService } from '../sessions-pos/session.service';
import { PaymentService } from '../finance/payments/payment.service';
import { CustomerPackageService } from '../packages/customer-package.service';
import { PackagePlanService } from '../packages/package-plan.service';
import { StaffService } from '../staff/personnel/staff.service';

function millis(value: FirestoreDate | undefined): number {
  if (!value) return 0;
  return value instanceof Date ? value.getTime() : value.toMillis();
}

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [RouterLink, DecimalPipe, MatIconModule, StatusBadge, FirestoreDatePipe],
  templateUrl: './customer-detail.html',
})
export class CustomerDetail {
  private readonly customerService = inject(CustomerService);
  private readonly sessionService = inject(SessionService);
  private readonly paymentService = inject(PaymentService);
  private readonly packageService = inject(CustomerPackageService);

  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  readonly id = input.required<string>();

  private readonly id$ = toObservable(this.id);

  readonly customer = toSignal(this.id$.pipe(switchMap((id) => this.customerService.watchOne(id))), { initialValue: undefined });

  private readonly rawSessions = toSignal(this.id$.pipe(switchMap((id) => this.sessionService.watchByCustomer(id))), { initialValue: [] });
  private readonly rawPayments = toSignal(this.id$.pipe(switchMap((id) => this.paymentService.watchByCustomer(id))), { initialValue: [] });
  private readonly rawPackages = toSignal(this.id$.pipe(switchMap((id) => this.packageService.watchByCustomer(id))), { initialValue: [] });

  private readonly plans = inject(PackagePlanService).watchAllSignal();
  private readonly staff = inject(StaffService).watchAllSignal();

  readonly sessions = computed(() => [...this.rawSessions()].sort((a, b) => millis(b.createdAt) - millis(a.createdAt)));
  readonly payments = computed(() => [...this.rawPayments()].sort((a, b) => millis(b.createdAt) - millis(a.createdAt)));
  readonly packages = computed(() => [...this.rawPackages()].sort((a, b) => millis(b.satisTarihi) - millis(a.satisTarihi)));

  readonly planName = computed(() => new Map(this.plans().map((p) => [p.id, p.ad])));
  readonly staffName = computed(() => new Map(this.staff().map((s) => [s.id, s.ad])));

  /** Session totals + standalone payments (package sales, top-ups), refunds netted out. */
  readonly totalSpent = computed(
    () =>
      Math.round((this.sessions().reduce((s, x) => s + x.totalAmount, 0) + this.payments().reduce((s, p) => s + p.amount, 0)) * 100) / 100,
  );
  readonly activePackageCount = computed(() => this.packages().filter((p) => p.status === 'active').length);
}
