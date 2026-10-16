import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StatusBadge } from '../../../core/ui/status-badge/status-badge';
import { FirestoreDatePipe } from '../../../core/pipes/firestore-date.pipe';
import {
  Customer,
  CustomerGender,
  FirestoreDate,
  PAYMENT_METHOD_LABELS,
  WithId,
} from '../../../core/models';
import { SessionService } from '../../sessions-pos/session.service';
import { PaymentService } from '../../finance/payments/payment.service';
import { CustomerPackageService } from '../../packages/customer-package.service';
import { PackagePlanService } from '../../packages/package-plan.service';
import { StaffService } from '../../staff/personnel/staff.service';

function millis(value: FirestoreDate | undefined): number {
  if (!value) return 0;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

const GENDER_LABELS: Record<CustomerGender, string> = {
  kadin: 'Kadın',
  erkek: 'Erkek',
  belirtilmedi: 'Belirtilmedi',
};

@Component({
  selector: 'app-customer-detail-modal',
  standalone: true,
  imports: [
    DecimalPipe,
    MatIconModule,
    MatTooltipModule,
    StatusBadge,
    FirestoreDatePipe,
  ],
  templateUrl: './customer-detail-modal.html',
})
export class CustomerDetailModal {
  private readonly sessionService = inject(SessionService);
  private readonly paymentService = inject(PaymentService);
  private readonly packageService = inject(CustomerPackageService);

  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  readonly genderLabels = GENDER_LABELS;

  readonly customer = input<WithId<Customer> | null>(null);
  readonly isOpen = input<boolean>(false);
  readonly close = output<void>();
  readonly edit = output<WithId<Customer>>();

  readonly activeTab = signal<'overview' | 'sessions' | 'packages' | 'payments'>('overview');

  readonly customerId = computed(() => this.customer()?.id ?? null);
  private readonly id$ = toObservable(this.customerId);

  private readonly rawSessions = toSignal(
    this.id$.pipe(switchMap((id) => (id ? this.sessionService.watchByCustomer(id) : of([])))),
    { initialValue: [] },
  );
  private readonly rawPayments = toSignal(
    this.id$.pipe(switchMap((id) => (id ? this.paymentService.watchByCustomer(id) : of([])))),
    { initialValue: [] },
  );
  private readonly rawPackages = toSignal(
    this.id$.pipe(switchMap((id) => (id ? this.packageService.watchByCustomer(id) : of([])))),
    { initialValue: [] },
  );

  private readonly plans = inject(PackagePlanService).watchAllSignal();
  private readonly staff = inject(StaffService).watchAllSignal();

  readonly sessions = computed(() =>
    [...this.rawSessions()].sort((a, b) => millis(b.createdAt) - millis(a.createdAt)),
  );
  readonly payments = computed(() =>
    [...this.rawPayments()].sort((a, b) => millis(b.createdAt) - millis(a.createdAt)),
  );
  readonly packages = computed(() =>
    [...this.rawPackages()].sort((a, b) => millis(b.satisTarihi) - millis(a.satisTarihi)),
  );

  readonly planName = computed(() => new Map(this.plans().map((p) => [p.id, p.ad])));
  readonly staffName = computed(() => new Map(this.staff().map((s) => [s.id, s.ad])));

  readonly totalSpent = computed(() => {
    const sTot = this.sessions().reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const pTot = this.payments().reduce((sum, p) => sum + (p.amount || 0), 0);
    return Math.round((sTot + pTot) * 100) / 100;
  });

  readonly activePackageCount = computed(
    () => this.packages().filter((p) => p.status === 'active').length,
  );

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.onClose();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onEdit(): void {
    const c = this.customer();
    if (c) {
      this.edit.emit(c);
    }
  }
}
