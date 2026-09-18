import { Component, Signal, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { MatIconModule } from '@angular/material/icon';
import { SimpleCrudListBase } from '../../../core/base/simple-crud-list-base';
import { EmptyState } from '../../../core/ui/empty-state/empty-state';
import { FirestoreDatePipe } from '../../../core/pipes/firestore-date.pipe';
import { SlideOverDrawer } from '../../../core/ui/slide-over-drawer/slide-over-drawer';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { EXPENSE_CATEGORY_LABELS, Expense, ExpenseCategory, WithId } from '../../../core/models';
import { ExpenseService } from './expense.service';
import { StaffService } from '../../staff/personnel/staff.service';

interface ExpenseForm {
  kategori: ExpenseCategory;
  amount: number;
  staffId: string;
  note: string;
}

const EMPTY_FORM: ExpenseForm = { kategori: 'genel', amount: 0, staffId: '', note: '' };

@Component({
  selector: 'app-expenses-list',
  standalone: true,
  imports: [FormsModule, DecimalPipe, FirestoreDatePipe, MatIconModule, EmptyState, SlideOverDrawer],
  templateUrl: './expenses-list.html',
})
export class ExpensesList extends SimpleCrudListBase<Expense> {
  private readonly expenseService = inject(ExpenseService);
  private readonly confirmService = inject(ConfirmService);
  private readonly staffService = inject(StaffService);

  readonly categoryLabels = EXPENSE_CATEGORY_LABELS;
  readonly categories: ExpenseCategory[] = ['maas', 'prim', 'avans', 'genel'];

  readonly items: Signal<WithId<Expense>[]> = this.expenseService.watchAllSignal();
  readonly staff = this.staffService.watchAllSignal();
  readonly staffNameById = computed(() => new Map(this.staff().map((s) => [s.id, s.ad])));

  readonly totalThisList = computed(() => round2(this.filtered().reduce((sum, e) => sum + e.amount, 0)));

  protected override matchesSearch(item: WithId<Expense>, query: string): boolean {
    return (item.note ?? '').toLowerCase().includes(query) || this.categoryLabels[item.kategori].toLowerCase().includes(query);
  }

  readonly drawerOpen = signal(false);
  readonly saving = signal(false);
  form: ExpenseForm = { ...EMPTY_FORM };

  openCreateDrawer(): void {
    this.form = { ...EMPTY_FORM };
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  async save(): Promise<void> {
    if (this.form.amount <= 0) return;
    this.saving.set(true);
    try {
      await this.expenseService.create({
        kategori: this.form.kategori,
        amount: this.form.amount,
        staffId: this.form.staffId || undefined,
        note: this.form.note.trim() || undefined,
        date: Timestamp.fromDate(new Date()),
      } as Omit<Expense, 'id'>);
      this.closeDrawer();
    } finally {
      this.saving.set(false);
    }
  }

  async remove(item: WithId<Expense>): Promise<void> {
    const confirmed = await this.confirmService.confirmDelete(this.categoryLabels[item.kategori] + ' gideri');
    if (confirmed) {
      await this.expenseService.remove(item.id);
    }
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
