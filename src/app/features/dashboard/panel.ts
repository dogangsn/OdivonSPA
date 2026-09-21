import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { of } from 'rxjs';
import { KpiCard } from '../../core/ui/kpi-card/kpi-card';
import { AuthService } from '../../core/auth/auth.service';
import { CustomerService } from '../customers/customer.service';
import { AppointmentService } from '../appointments/appointment.service';
import { SessionService } from '../sessions-pos/session.service';
import { PaymentService } from '../finance/payments/payment.service';
import { CommissionAccrualService } from '../finance/commissions/commission-accrual.service';

@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [KpiCard, DecimalPipe],
  templateUrl: './panel.html',
})
export class Panel {
  readonly auth = inject(AuthService);

  private readonly todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  private readonly todayEnd = new Date(this.todayStart.getTime() + 24 * 60 * 60 * 1000);

  readonly customers = inject(CustomerService).watchAllSignal();
  private readonly appointments = toSignal(inject(AppointmentService).watchByDateRange(this.todayStart, this.todayEnd), { initialValue: [] });
  private readonly sessions = toSignal(inject(SessionService).watchByDateRange(this.todayStart, this.todayEnd), { initialValue: [] });
  private readonly payments = toSignal(inject(PaymentService).watchByDateRange(this.todayStart, this.todayEnd), { initialValue: [] });
  private readonly pendingAccruals = toSignal(
    this.auth.isAdmin() ? inject(CommissionAccrualService).watchPending() : of([]),
    { initialValue: [] },
  );

  readonly appointmentCount = computed(() => this.appointments().filter((a) => a.status !== 'İptal').length);
  readonly revenueToday = computed(
    () => this.sessions().reduce((s, x) => s + x.totalAmount, 0) + this.payments().reduce((s, p) => s + p.amount, 0),
  );
  readonly pendingCommission = computed(() => this.pendingAccruals().reduce((s, a) => s + a.amount, 0));
}
