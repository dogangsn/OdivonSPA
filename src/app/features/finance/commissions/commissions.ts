import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DonutChart } from '../../../core/ui/charts/donut-chart';
import { LineChart } from '../../../core/ui/charts/line-chart';
import { SlideOverDrawer } from '../../../core/ui/slide-over-drawer/slide-over-drawer';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { CommissionAccrualStatus, WithId, CommissionAccrual } from '../../../core/models';
import { CommissionAccrualService } from './commission-accrual.service';
import { StaffService } from '../../staff/personnel/staff.service';

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function startOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}
function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function asDate(value: unknown): Date {
  return value instanceof Date ? value : (value as { toDate: () => Date }).toDate();
}
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Component({
  selector: 'app-commissions',
  standalone: true,
  imports: [FormsModule, DecimalPipe, MatIconModule, DonutChart, LineChart, SlideOverDrawer],
  templateUrl: './commissions.html',
})
export class Commissions {
  private readonly accrualService = inject(CommissionAccrualService);
  private readonly staffService = inject(StaffService);
  private readonly confirmService = inject(ConfirmService);

  private readonly allStaff = this.staffService.watchAllSignal();
  readonly staff = computed(() => this.allStaff().filter((s) => s.role === 'therapist'));
  readonly staffNameById = computed(() => new Map(this.allStaff().map((s) => [s.id, s.ad])));

  readonly monthAnchor = signal(new Date());
  readonly filterStaffId = signal('');
  readonly filterStatus = signal<CommissionAccrualStatus | ''>('');

  private readonly monthRange = computed(() => ({ start: startOfMonth(this.monthAnchor()), end: startOfNextMonth(this.monthAnchor()) }));

  readonly monthAccruals = toSignal(
    toObservable(this.monthRange).pipe(switchMap((r) => this.accrualService.watchByDateRange(r.start, r.end))),
    { initialValue: [] as WithId<CommissionAccrual>[] },
  );

  readonly filteredAccruals = computed(() =>
    this.monthAccruals().filter(
      (a) => (!this.filterStaffId() || a.staffId === this.filterStaffId()) && (!this.filterStatus() || a.status === this.filterStatus()),
    ),
  );

  readonly totalAccrued = computed(() => round2(this.filteredAccruals().reduce((s, a) => s + a.amount, 0)));
  readonly totalPaid = computed(() => round2(this.filteredAccruals().filter((a) => a.status === 'paid').reduce((s, a) => s + a.amount, 0)));
  readonly totalPending = computed(() => round2(this.filteredAccruals().filter((a) => a.status === 'pending').reduce((s, a) => s + a.amount, 0)));
  readonly paidRatio = computed(() => (this.totalAccrued() > 0 ? Math.round((this.totalPaid() / this.totalAccrued()) * 100) : 0));

  readonly todayAccrued = computed(() => {
    const todayStr = toDateStr(new Date());
    return round2(this.filteredAccruals().filter((a) => toDateStr(asDate(a.date)) === todayStr).reduce((s, a) => s + a.amount, 0));
  });

  readonly staffBreakdown = computed(() => {
    const totals = new Map<string, number>();
    for (const a of this.filteredAccruals()) {
      totals.set(a.staffId, round2((totals.get(a.staffId) ?? 0) + a.amount));
    }
    const rows = [...totals.entries()]
      .map(([staffId, amount]) => ({ staffId, name: this.staffNameById().get(staffId) ?? '—', amount }))
      .sort((a, b) => b.amount - a.amount);
    const max = rows[0]?.amount ?? 1;
    return rows.map((r) => ({ ...r, pct: max > 0 ? Math.round((r.amount / max) * 100) : 0 }));
  });

  readonly dailyTrend = computed(() => {
    const byDate = new Map<string, number>();
    for (const a of this.filteredAccruals()) {
      const key = toDateStr(asDate(a.date));
      byDate.set(key, round2((byDate.get(key) ?? 0) + a.amount));
    }
    const days = [...byDate.keys()].sort();
    return {
      categories: days.map((d) => d.split('-').slice(1).reverse().join('.')),
      series: [{ name: 'Prim', data: days.map((d) => byDate.get(d) ?? 0) }],
    };
  });

  resetFilters(): void {
    this.filterStaffId.set('');
    this.filterStatus.set('');
  }

  // ---- Payout drawer ----
  readonly payoutDrawerOpen = signal(false);
  readonly payoutStaffId = signal('');
  readonly selectedAccrualIds = signal<Set<string>>(new Set());
  readonly paying = signal(false);

  readonly pendingForPayoutStaff = computed(() =>
    this.monthAccruals().filter((a) => a.staffId === this.payoutStaffId() && a.status === 'pending'),
  );
  readonly payoutSelectedTotal = computed(() =>
    round2(this.pendingForPayoutStaff().filter((a) => this.selectedAccrualIds().has(a.id)).reduce((s, a) => s + a.amount, 0)),
  );

  openPayoutDrawer(): void {
    this.payoutStaffId.set(this.staff()[0]?.id ?? '');
    this.selectedAccrualIds.set(new Set());
    this.payoutDrawerOpen.set(true);
  }

  onPayoutStaffChange(staffId: string): void {
    this.payoutStaffId.set(staffId);
    this.selectedAccrualIds.set(new Set());
  }

  closePayoutDrawer(): void {
    this.payoutDrawerOpen.set(false);
  }

  toggleAccrualSelection(id: string): void {
    const next = new Set(this.selectedAccrualIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedAccrualIds.set(next);
  }

  selectAllPending(): void {
    this.selectedAccrualIds.set(new Set(this.pendingForPayoutStaff().map((a) => a.id)));
  }

  async confirmPayout(): Promise<void> {
    const staffId = this.payoutStaffId();
    const accrualIds = [...this.selectedAccrualIds()];
    if (!staffId || accrualIds.length === 0) return;

    this.paying.set(true);
    try {
      const result = await this.accrualService.payout(staffId, accrualIds);
      await this.confirmService.success('Prim Ödemesi Tamamlandı', `₺${result.totalAmount.toFixed(2)} tutarında gider oluşturuldu.`);
      this.closePayoutDrawer();
    } catch (err) {
      await this.confirmService.error('Ödeme Yapılamadı', err instanceof Error ? err.message : undefined);
    } finally {
      this.paying.set(false);
    }
  }
}
