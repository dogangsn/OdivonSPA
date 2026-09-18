import { Component, Signal, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { MatIconModule } from '@angular/material/icon';
import { SimpleCrudListBase } from '../../../core/base/simple-crud-list-base';
import { SlideOverDrawer } from '../../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge } from '../../../core/ui/status-badge/status-badge';
import { EmptyState } from '../../../core/ui/empty-state/empty-state';
import { STAFF_ROLE_LABELS, Staff, WithId } from '../../../core/models';
import { StaffService } from './staff.service';
import { SessionService } from '../../sessions-pos/session.service';
import { CommissionAccrualService } from '../../finance/commissions/commission-accrual.service';

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function startOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface StaffForm {
  uzmanliklarText: string;
  primOraniVarsayilan: number;
  iban: string;
  telefon: string;
  renk: string;
  iseGirisTarihi: string; // yyyy-MM-dd for <input type="date">
}

@Component({
  selector: 'app-personnel-list',
  standalone: true,
  imports: [FormsModule, DecimalPipe, MatIconModule, SlideOverDrawer, StatusBadge, EmptyState],
  templateUrl: './personnel-list.html',
})
export class PersonnelList extends SimpleCrudListBase<Staff> {
  private readonly staffService = inject(StaffService);
  private readonly sessionService = inject(SessionService);
  private readonly accrualService = inject(CommissionAccrualService);

  readonly roleLabels = STAFF_ROLE_LABELS;
  readonly items: Signal<WithId<Staff>[]> = this.staffService.watchAllSignal();

  private readonly monthRange = signal({ start: startOfMonth(new Date()), end: startOfNextMonth(new Date()) });

  private readonly monthSessions = toSignal(
    toObservable(this.monthRange).pipe(switchMap((r) => this.sessionService.watchByDateRange(r.start, r.end))),
    { initialValue: [] },
  );
  private readonly monthAccruals = toSignal(
    toObservable(this.monthRange).pipe(switchMap((r) => this.accrualService.watchByDateRange(r.start, r.end))),
    { initialValue: [] },
  );

  monthlySummaryFor(staffId: string) {
    const sessions = this.monthSessions().filter((s) => s.staffId === staffId);
    const accruals = this.monthAccruals().filter((a) => a.staffId === staffId);
    return {
      seansAdedi: sessions.length,
      ciro: round2(sessions.reduce((sum, s) => sum + s.totalAmount, 0)),
      primTahakkuk: round2(accruals.reduce((sum, a) => sum + a.amount, 0)),
      primOdenen: round2(accruals.filter((a) => a.status === 'paid').reduce((sum, a) => sum + a.amount, 0)),
    };
  }

  protected override matchesSearch(item: WithId<Staff>, query: string): boolean {
    return item.ad.toLowerCase().includes(query) || item.email.toLowerCase().includes(query);
  }

  readonly drawerOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  form: StaffForm = { uzmanliklarText: '', primOraniVarsayilan: 0, iban: '', telefon: '', renk: '#6366f1', iseGirisTarihi: '' };

  openEditDrawer(item: WithId<Staff>): void {
    this.editingId.set(item.id);
    const startDate = item.iseGirisTarihi instanceof Timestamp ? item.iseGirisTarihi.toDate() : item.iseGirisTarihi;
    this.form = {
      uzmanliklarText: item.uzmanliklar.join(', '),
      primOraniVarsayilan: item.primOraniVarsayilan,
      iban: item.iban ?? '',
      telefon: item.telefon ?? '',
      renk: item.renk,
      iseGirisTarihi: startDate ? toDateInputValue(startDate) : '',
    };
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  async save(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    this.saving.set(true);
    try {
      await this.staffService.update(id, {
        uzmanliklar: this.form.uzmanliklarText.split(',').map((t) => t.trim()).filter(Boolean),
        primOraniVarsayilan: this.form.primOraniVarsayilan,
        iban: this.form.iban.trim() || undefined,
        telefon: this.form.telefon.trim() || undefined,
        renk: this.form.renk,
        iseGirisTarihi: this.form.iseGirisTarihi ? Timestamp.fromDate(new Date(this.form.iseGirisTarihi)) : undefined,
      });
      this.closeDrawer();
    } finally {
      this.saving.set(false);
    }
  }
}
