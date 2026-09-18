import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, switchMap } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DonutChart } from '../../../core/ui/charts/donut-chart';
import { LineChart } from '../../../core/ui/charts/line-chart';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PAYMENT_METHOD_LABELS, PaymentMethod } from '../../../core/models';
import { CashRegisterDayService } from './cash-register-day.service';
import { SessionService } from '../../sessions-pos/session.service';
import { PaymentService } from '../payments/payment.service';
import { ExpenseService } from '../expenses/expense.service';
import { CommissionAccrualService } from '../commissions/commission-accrual.service';

interface DayTotals {
  totalsByMethod: Partial<Record<PaymentMethod, number>>;
  totalIncome: number;
  totalExpense: number;
  totalCommission: number;
  netCash: number;
}

@Component({
  selector: 'app-cash-register-day',
  standalone: true,
  imports: [DecimalPipe, MatIconModule, DonutChart, LineChart],
  templateUrl: './cash-register-day.html',
})
export class CashRegisterDayPage {
  private readonly cashRegisterDayService = inject(CashRegisterDayService);
  private readonly sessionService = inject(SessionService);
  private readonly paymentService = inject(PaymentService);
  private readonly expenseService = inject(ExpenseService);
  private readonly accrualService = inject(CommissionAccrualService);
  private readonly confirmService = inject(ConfirmService);
  readonly auth = inject(AuthService);

  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  readonly paymentMethods: PaymentMethod[] = ['nakit', 'kart', 'havale', 'diger'];
  readonly selectedDate = signal(startOfDay(new Date()));
  readonly dateStr = computed(() => toDateStr(this.selectedDate()));

  readonly closedDay = toSignal(
    toObservable(this.dateStr).pipe(switchMap((date) => this.cashRegisterDayService.watchOne(date))),
    { initialValue: undefined },
  );

  readonly isClosed = computed(() => this.closedDay()?.status === 'closed');

  private readonly liveTotals = toSignal(
    toObservable(this.selectedDate).pipe(
      switchMap((date) => {
        const end = addDays(date, 1);
        return combineLatest([
          this.sessionService.watchByDateRange(date, end),
          this.paymentService.watchByDateRange(date, end),
          this.expenseService.watchByDateRange(date, end),
          this.accrualService.watchByDateRange(date, end),
        ]).pipe(
          map(([sessions, payments, expenses, accruals]): DayTotals => {
            const totalsByMethod: Partial<Record<PaymentMethod, number>> = {};
            const add = (method: PaymentMethod, amount: number) => {
              totalsByMethod[method] = round2((totalsByMethod[method] ?? 0) + amount);
            };

            let totalIncome = 0;
            for (const session of sessions) {
              for (const payment of session.payments) {
                add(payment.method, payment.amount);
                totalIncome += payment.amount;
              }
            }
            for (const payment of payments) {
              add(payment.method, payment.amount);
              totalIncome += payment.amount;
            }

            const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
            const totalCommission = accruals.reduce((sum, a) => sum + a.amount, 0);

            return {
              totalsByMethod,
              totalIncome: round2(totalIncome),
              totalExpense: round2(totalExpense),
              totalCommission: round2(totalCommission),
              netCash: round2(totalIncome - totalExpense),
            };
          }),
        );
      }),
    ),
    { initialValue: { totalsByMethod: {}, totalIncome: 0, totalExpense: 0, totalCommission: 0, netCash: 0 } as DayTotals },
  );

  readonly displayTotals = computed<DayTotals>(() => {
    const closed = this.closedDay();
    if (closed?.status === 'closed') {
      return {
        totalsByMethod: closed.totalsByMethod,
        totalIncome: closed.totalIncome,
        totalExpense: closed.totalExpense,
        totalCommission: closed.totalCommission,
        netCash: closed.netCash,
      };
    }
    return this.liveTotals();
  });

  readonly giderOrani = computed(() => {
    const t = this.displayTotals();
    return t.totalIncome > 0 ? Math.round((t.totalExpense / t.totalIncome) * 100) : 0;
  });

  readonly netMarjOrani = computed(() => {
    const t = this.displayTotals();
    return t.totalIncome > 0 ? Math.round((t.netCash / t.totalIncome) * 100) : 0;
  });

  readonly paymentMethodDonut = computed(() => {
    const entries = Object.entries(this.displayTotals().totalsByMethod) as [PaymentMethod, number][];
    return {
      labels: entries.map(([method]) => this.paymentMethodLabels[method]),
      series: entries.map(([, amount]) => amount),
    };
  });

  // ---- Last 7 days trend ----
  private readonly last7Range = computed(() => ({ start: addDays(this.selectedDate(), -6), end: this.selectedDate() }));

  readonly last7Days = toSignal(
    toObservable(this.last7Range).pipe(
      switchMap((range) => this.cashRegisterDayService.watchRange(toDateStr(range.start), toDateStr(range.end))),
    ),
    { initialValue: [] },
  );

  readonly trendCategories = computed(() => buildLast7Labels(this.selectedDate()));
  readonly trendSeries = computed(() => {
    const byDate = new Map(this.last7Days().map((d) => [d.date, d]));
    const labels = buildLast7Dates(this.selectedDate());
    return [
      { name: 'Gelir', data: labels.map((d) => byDate.get(d)?.totalIncome ?? 0) },
      { name: 'Gider', data: labels.map((d) => byDate.get(d)?.totalExpense ?? 0) },
    ];
  });

  prevDay(): void {
    this.selectedDate.set(addDays(this.selectedDate(), -1));
  }

  nextDay(): void {
    this.selectedDate.set(addDays(this.selectedDate(), 1));
  }

  today(): void {
    this.selectedDate.set(startOfDay(new Date()));
  }

  readonly closing = signal(false);

  async closeDay(): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: 'Kasayı Kapat',
      text: `${this.dateStr()} tarihli gün kapatılacak. Bu işlemi onaylıyor musunuz?`,
    });
    if (!confirmed) return;
    this.closing.set(true);
    try {
      await this.cashRegisterDayService.closeDay(this.dateStr());
      await this.confirmService.success('Gün Kapatıldı');
    } catch (err) {
      await this.confirmService.error('Gün Kapatılamadı', err instanceof Error ? err.message : undefined);
    } finally {
      this.closing.set(false);
    }
  }

  async reopenDay(): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: 'Kasayı Yeniden Aç',
      text: 'Kapatılan gün yeniden açılacak, geçmiş kayıt saklanacak.',
      danger: true,
    });
    if (!confirmed) return;
    this.closing.set(true);
    try {
      await this.cashRegisterDayService.reopenDay(this.dateStr());
    } catch (err) {
      await this.confirmService.error('Gün Yeniden Açılamadı', err instanceof Error ? err.message : undefined);
    } finally {
      this.closing.set(false);
    }
  }
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildLast7Dates(end: Date): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(toDateStr(addDays(end, -i)));
  }
  return dates;
}

function buildLast7Labels(end: Date): string[] {
  return buildLast7Dates(end).map((d) => {
    const [, m, day] = d.split('-');
    return `${day}.${m}`;
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
