import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DonutChart } from '../../core/ui/charts/donut-chart';
import { LineChart } from '../../core/ui/charts/line-chart';
import { FirestoreDatePipe } from '../../core/pipes/firestore-date.pipe';
import { downloadCsv } from '../../core/util/csv-export';
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, PaymentMethod } from '../../core/models';
import { SessionService } from '../sessions-pos/session.service';
import { PaymentService } from '../finance/payments/payment.service';
import { ExpenseService } from '../finance/expenses/expense.service';
import { CommissionAccrualService } from '../finance/commissions/commission-accrual.service';
import { CustomerPackageService } from '../packages/customer-package.service';
import { PackagePlanService } from '../packages/package-plan.service';
import { StaffService } from '../staff/personnel/staff.service';

type ReportTab = 'ciro' | 'seans' | 'gider' | 'personel' | 'prim' | 'paket';

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function toDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}.${m}`;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function asDate(v: unknown): Date {
  return v instanceof Date ? v : (v as { toDate: () => Date }).toDate();
}
function dateKey(v: unknown): string {
  return toDateInput(asDate(v));
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [FormsModule, DecimalPipe, FirestoreDatePipe, MatIconModule, DonutChart, LineChart],
  templateUrl: './reports.html',
})
export class Reports {
  private readonly sessionService = inject(SessionService);
  private readonly paymentService = inject(PaymentService);
  private readonly expenseService = inject(ExpenseService);
  private readonly accrualService = inject(CommissionAccrualService);
  private readonly customerPackageService = inject(CustomerPackageService);
  private readonly packagePlanService = inject(PackagePlanService);
  private readonly staffService = inject(StaffService);

  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  readonly paymentMethods: PaymentMethod[] = ['nakit', 'kart', 'havale', 'diger'];
  readonly expenseCategoryLabels = EXPENSE_CATEGORY_LABELS;
  readonly expenseCategories = ['maas', 'prim', 'avans', 'genel'] as const;

  readonly tab = signal<ReportTab>('ciro');
  readonly tabs: ReportTab[] = ['ciro', 'seans', 'gider', 'personel', 'prim', 'paket'];

  private readonly today = new Date();
  readonly rangeStart = signal(toDateInput(new Date(this.today.getFullYear(), this.today.getMonth(), 1)));
  readonly rangeEnd = signal(toDateInput(this.today));

  private readonly range = computed(() => {
    const start = new Date(this.rangeStart());
    const end = new Date(this.rangeEnd());
    end.setDate(end.getDate() + 1); // inclusive end date
    return { start, end };
  });

  readonly staff = this.staffService.watchAllSignal();
  readonly staffNameById = computed(() => new Map(this.staff().map((s) => [s.id, s.ad])));

  readonly sessions = toSignal(
    toObservable(this.range).pipe(switchMap((r) => this.sessionService.watchByDateRange(r.start, r.end))),
    { initialValue: [] },
  );
  readonly payments = toSignal(
    toObservable(this.range).pipe(switchMap((r) => this.paymentService.watchByDateRange(r.start, r.end))),
    { initialValue: [] },
  );
  readonly expenses = toSignal(
    toObservable(this.range).pipe(switchMap((r) => this.expenseService.watchByDateRange(r.start, r.end))),
    { initialValue: [] },
  );
  readonly accruals = toSignal(
    toObservable(this.range).pipe(switchMap((r) => this.accrualService.watchByDateRange(r.start, r.end))),
    { initialValue: [] },
  );
  readonly soldPackages = toSignal(
    toObservable(this.range).pipe(switchMap((r) => this.customerPackageService.watchSoldByDateRange(r.start, r.end))),
    { initialValue: [] },
  );

  // ---- Ciro ----
  readonly ciroByMethod = computed(() => {
    const totals: Partial<Record<PaymentMethod, number>> = {};
    const add = (method: PaymentMethod, amount: number) => (totals[method] = round2((totals[method] ?? 0) + amount));
    for (const s of this.sessions()) for (const p of s.payments) add(p.method, p.amount);
    for (const p of this.payments()) add(p.method, p.amount);
    return totals;
  });
  readonly ciroTotal = computed(() => round2(Object.values(this.ciroByMethod()).reduce((s, v) => s + (v ?? 0), 0)));

  private readonly ciroByDayMap = computed(() => {
    const byDay = new Map<string, number>();
    for (const s of this.sessions()) {
      const key = dateKey(s.createdAt);
      byDay.set(key, round2((byDay.get(key) ?? 0) + s.totalAmount));
    }
    for (const p of this.payments()) {
      const key = dateKey(p.createdAt);
      byDay.set(key, round2((byDay.get(key) ?? 0) + p.amount));
    }
    return byDay;
  });

  readonly ciroByDay = computed(() => {
    const days = [...this.ciroByDayMap().keys()].sort();
    return { categories: days.map(toDateLabel), series: [{ name: 'Ciro', data: days.map((d) => this.ciroByDayMap().get(d) ?? 0) }] };
  });

  exportCiro(): void {
    const rows = [...this.ciroByDayMap().entries()].sort(([a], [b]) => a.localeCompare(b));
    downloadCsv('ciro-raporu.csv', ['Tarih', 'Ciro'], rows);
  }

  // ---- Seans ----
  readonly seansCount = computed(() => this.sessions().length);
  readonly seansServiceRevenue = computed(() =>
    round2(this.sessions().reduce((sum, s) => sum + s.items.filter((i) => i.kind === 'service').reduce((a, i) => a + i.price * i.qty - i.discount, 0), 0)),
  );
  readonly seansProductRevenue = computed(() =>
    round2(this.sessions().reduce((sum, s) => sum + s.items.filter((i) => i.kind === 'product').reduce((a, i) => a + i.price * i.qty - i.discount, 0), 0)),
  );

  exportSeans(): void {
    const rows = this.sessions().map((s) => [s.receiptNo, s.customerId, s.staffId, s.totalAmount, dateKey(s.createdAt)]);
    downloadCsv('seans-raporu.csv', ['Fiş No', 'Müşteri ID', 'Terapist ID', 'Tutar', 'Tarih'], rows);
  }

  // ---- Gider ----
  readonly giderByCategory = computed(() => {
    const totals = new Map<string, number>();
    for (const e of this.expenses()) totals.set(e.kategori, round2((totals.get(e.kategori) ?? 0) + e.amount));
    return totals;
  });
  readonly giderTotal = computed(() => round2(this.expenses().reduce((s, e) => s + e.amount, 0)));

  exportGider(): void {
    const rows = this.expenses().map((e) => [this.expenseCategoryLabels[e.kategori], e.amount, e.note ?? '', dateKey(e.date)]);
    downloadCsv('gider-raporu.csv', ['Kategori', 'Tutar', 'Not', 'Tarih'], rows);
  }

  // ---- Personel ----
  readonly personelBreakdown = computed(() => {
    const rows = this.staff().map((st) => {
      const staffSessions = this.sessions().filter((s) => s.staffId === st.id);
      const staffAccruals = this.accruals().filter((a) => a.staffId === st.id);
      return {
        staffId: st.id,
        name: st.ad,
        seansAdedi: staffSessions.length,
        ciro: round2(staffSessions.reduce((s, x) => s + x.totalAmount, 0)),
        prim: round2(staffAccruals.reduce((s, x) => s + x.amount, 0)),
      };
    });
    return rows.filter((r) => r.seansAdedi > 0 || r.prim > 0);
  });

  exportPersonel(): void {
    const rows = this.personelBreakdown().map((r) => [r.name, r.seansAdedi, r.ciro, r.prim]);
    downloadCsv('personel-raporu.csv', ['Personel', 'Seans Adedi', 'Ciro', 'Prim'], rows);
  }

  // ---- Prim ----
  readonly primTahakkuk = computed(() => round2(this.accruals().reduce((s, a) => s + a.amount, 0)));
  readonly primOdenen = computed(() => round2(this.accruals().filter((a) => a.status === 'paid').reduce((s, a) => s + a.amount, 0)));
  readonly primBekleyen = computed(() => round2(this.accruals().filter((a) => a.status === 'pending').reduce((s, a) => s + a.amount, 0)));
  readonly primIptal = computed(() => round2(this.accruals().filter((a) => a.status === 'cancelled').reduce((s, a) => s + a.amount, 0)));

  exportPrim(): void {
    const rows = this.accruals().map((a) => [this.staffNameById().get(a.staffId) ?? a.staffId, a.amount, a.status, dateKey(a.date)]);
    downloadCsv('prim-raporu.csv', ['Personel', 'Tutar', 'Durum', 'Tarih'], rows);
  }

  // ---- Paket ----
  private readonly packagePlans = this.packagePlanService.watchAllSignal();
  private readonly planPriceById = computed(() => new Map(this.packagePlans().map((p) => [p.id, p.fiyat])));

  readonly paketSatisAdedi = computed(() => this.soldPackages().length);
  readonly paketSatisTutari = computed(() =>
    round2(this.soldPackages().reduce((sum, p) => sum + (this.planPriceById().get(p.packagePlanId) ?? 0), 0)),
  );
  readonly paketDurumDagilimi = computed(() => {
    const totals = { active: 0, expired: 0, tamamlandi: 0 };
    for (const p of this.soldPackages()) totals[p.status]++;
    return totals;
  });
  readonly paketKullanimOrani = computed(() => {
    const total = this.soldPackages().reduce((s, p) => s + p.toplamSeans, 0);
    const used = this.soldPackages().reduce((s, p) => s + (p.toplamSeans - p.kalanSeans), 0);
    return total > 0 ? Math.round((used / total) * 100) : 0;
  });

  exportPaket(): void {
    const rows = this.soldPackages().map((p) => [p.customerId, p.toplamSeans, p.kalanSeans, p.status, dateKey(p.satisTarihi)]);
    downloadCsv('paket-raporu.csv', ['Müşteri ID', 'Toplam Seans', 'Kalan Seans', 'Durum', 'Satış Tarihi'], rows);
  }

  print(): void {
    window.print();
  }
}
