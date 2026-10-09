import { Component, Signal, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SimpleCrudListBase } from '../../../core/base/simple-crud-list-base';
import { KpiCard } from '../../../core/ui/kpi-card/kpi-card';
import { EmptyState } from '../../../core/ui/empty-state/empty-state';
import { FirestoreDatePipe } from '../../../core/pipes/firestore-date.pipe';
import { SlideOverDrawer } from '../../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge, BadgeVariant } from '../../../core/ui/status-badge/status-badge';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { StaffTask, TaskPriority, TaskStatus, WithId } from '../../../core/models';
import { TaskService } from './task.service';
import { StaffService } from '../personnel/staff.service';
import { ListWindow, LoadMore } from '../../../core/ui/load-more/load-more';

interface TaskForm {
  baslik: string;
  aciklama: string;
  staffId: string;
  dueDate: string;
  priority: TaskPriority;
}

const STATUS_LABELS: Record<TaskStatus, string> = { acik: 'Açık', devam: 'Devam Ediyor', tamamlandi: 'Tamamlandı' };
const STATUS_VARIANT: Record<TaskStatus, BadgeVariant> = { acik: 'slate', devam: 'sky', tamamlandi: 'emerald' };
const PRIORITY_LABELS: Record<TaskPriority, string> = { dusuk: 'Düşük', normal: 'Normal', yuksek: 'Yüksek' };
const PRIORITY_VARIANT: Record<TaskPriority, BadgeVariant> = { dusuk: 'slate', normal: 'sky', yuksek: 'rose' };

@Component({
  selector: 'app-tasks-list',
  standalone: true,
  imports: [KpiCard, FormsModule, FirestoreDatePipe, MatIconModule, EmptyState, SlideOverDrawer, StatusBadge, LoadMore],
  templateUrl: './tasks-list.html',
})
export class TasksList extends SimpleCrudListBase<StaffTask> {
  private readonly taskService = inject(TaskService);
  private readonly confirmService = inject(ConfirmService);
  private readonly staffService = inject(StaffService);

  readonly statusLabels = STATUS_LABELS;
  readonly statusVariant = STATUS_VARIANT;
  readonly priorityLabels = PRIORITY_LABELS;
  readonly priorityVariant = PRIORITY_VARIANT;
  readonly statuses: TaskStatus[] = ['acik', 'devam', 'tamamlandi'];
  readonly priorities: TaskPriority[] = ['dusuk', 'normal', 'yuksek'];

  readonly listWindow = new ListWindow();
  readonly items: Signal<WithId<StaffTask>[]> = this.taskService.watchRecentSignal(this.listWindow.count);
  readonly hasMore = this.listWindow.hasMore(this.items);
  readonly staff = this.staffService.watchAllSignal();
  readonly staffNameById = computed(() => new Map(this.staff().map((s) => [s.id, s.ad])));

  readonly countByStatus = computed(() => {
    const counts: Record<TaskStatus, number> = { acik: 0, devam: 0, tamamlandi: 0 };
    for (const t of this.items()) counts[t.status]++;
    return counts;
  });
  readonly completionRate = computed(() => {
    const total = this.items().length;
    return total ? Math.round((this.countByStatus().tamamlandi / total) * 100) : 0;
  });
  readonly highPriorityOpen = computed(
    () => this.items().filter((t) => t.priority === 'yuksek' && t.status !== 'tamamlandi').length,
  );

  protected override matchesSearch(item: WithId<StaffTask>, query: string): boolean {
    return item.baslik.toLowerCase().includes(query);
  }

  readonly drawerOpen = signal(false);
  readonly saving = signal(false);
  form: TaskForm = { baslik: '', aciklama: '', staffId: '', dueDate: '', priority: 'normal' };

  openCreateDrawer(): void {
    this.form = { baslik: '', aciklama: '', staffId: '', dueDate: '', priority: 'normal' };
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  async save(): Promise<void> {
    if (!this.form.baslik.trim()) return;
    this.saving.set(true);
    try {
      await this.taskService.create({
        baslik: this.form.baslik.trim(),
        aciklama: this.form.aciklama.trim() || undefined,
        staffId: this.form.staffId || undefined,
        dueDate: this.form.dueDate ? new Date(this.form.dueDate) : undefined,
        status: 'acik',
        priority: this.form.priority,
      } as Omit<StaffTask, 'id'>);
      this.closeDrawer();
    } finally {
      this.saving.set(false);
    }
  }

  async setStatus(item: WithId<StaffTask>, status: TaskStatus): Promise<void> {
    await this.taskService.update(item.id, { status });
  }

  async remove(item: WithId<StaffTask>): Promise<void> {
    const confirmed = await this.confirmService.confirmDelete(item.baslik);
    if (confirmed) {
      await this.taskService.remove(item.id);
    }
  }
}
