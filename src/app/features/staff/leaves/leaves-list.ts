import { Component, Signal, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SimpleCrudListBase } from '../../../core/base/simple-crud-list-base';
import { EmptyState } from '../../../core/ui/empty-state/empty-state';
import { FirestoreDatePipe } from '../../../core/pipes/firestore-date.pipe';
import { SlideOverDrawer } from '../../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge } from '../../../core/ui/status-badge/status-badge';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { AuthService } from '../../../core/auth/auth.service';
import { BadgeVariant } from '../../../core/ui/status-badge/status-badge';
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS, LeaveStatus, LeaveType, StaffLeave, WithId } from '../../../core/models';
import { LeaveService } from './leave.service';
import { StaffService } from '../personnel/staff.service';
import { ListWindow, LoadMore } from '../../../core/ui/load-more/load-more';

interface LeaveForm {
  staffId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  note: string;
}

@Component({
  selector: 'app-leaves-list',
  standalone: true,
  imports: [FormsModule, FirestoreDatePipe, MatIconModule, EmptyState, SlideOverDrawer, StatusBadge, LoadMore],
  templateUrl: './leaves-list.html',
})
export class LeavesList extends SimpleCrudListBase<StaffLeave> {
  private readonly leaveService = inject(LeaveService);
  private readonly confirmService = inject(ConfirmService);
  private readonly staffService = inject(StaffService);
  private readonly auth = inject(AuthService);

  readonly leaveTypeLabels = LEAVE_TYPE_LABELS;
  readonly leaveStatusLabels = LEAVE_STATUS_LABELS;
  readonly leaveStatusVariants: Record<LeaveStatus, BadgeVariant> = { beklemede: 'amber', onaylandi: 'emerald', reddedildi: 'rose' };
  /** Admin and reception record leave for anyone (approved right away); others request their own. */
  readonly canManage = computed(() => this.auth.role() === 'admin' || this.auth.role() === 'reception');
  readonly isAdmin = this.auth.isAdmin;
  readonly leaveTypes: LeaveType[] = ['yillik', 'rapor', 'ucretsiz', 'diger'];

  readonly listWindow = new ListWindow();
  readonly items: Signal<WithId<StaffLeave>[]> = this.leaveService.watchRecentSignal(this.listWindow.count);
  readonly hasMore = this.listWindow.hasMore(this.items);
  readonly staff = this.staffService.watchAllSignal();
  readonly staffNameById = computed(() => new Map(this.staff().map((s) => [s.id, s.ad])));

  readonly drawerOpen = signal(false);
  readonly saving = signal(false);
  form: LeaveForm = { staffId: '', type: 'yillik', startDate: '', endDate: '', note: '' };

  openCreateDrawer(): void {
    this.form = {
      staffId: this.canManage() ? '' : this.auth.user()?.uid ?? '',
      type: 'yillik',
      startDate: '',
      endDate: '',
      note: '',
    };
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  async save(): Promise<void> {
    if (!this.form.staffId || !this.form.startDate || !this.form.endDate) return;
    if (this.form.endDate < this.form.startDate) {
      await this.confirmService.error('Geçersiz Tarih', 'Bitiş tarihi başlangıçtan önce olamaz.');
      return;
    }
    this.saving.set(true);
    try {
      await this.leaveService.create({
        staffId: this.form.staffId,
        type: this.form.type,
        status: this.canManage() ? 'onaylandi' : 'beklemede',
        startDate: new Date(this.form.startDate),
        endDate: new Date(this.form.endDate),
        note: this.form.note.trim() || undefined,
      } as Omit<StaffLeave, 'id'>);
      this.closeDrawer();
    } catch (err) {
      await this.confirmService.error('İzin Kaydedilemedi', err instanceof Error ? err.message : undefined);
    } finally {
      this.saving.set(false);
    }
  }

  statusOf(item: StaffLeave): LeaveStatus {
    return item.status ?? 'onaylandi';
  }

  async review(item: WithId<StaffLeave>, status: 'onaylandi' | 'reddedildi'): Promise<void> {
    try {
      await this.leaveService.update(item.id, { status });
    } catch (err) {
      await this.confirmService.error('İzin Güncellenemedi', err instanceof Error ? err.message : undefined);
    }
  }

  async remove(item: WithId<StaffLeave>): Promise<void> {
    const confirmed = await this.confirmService.confirmDelete('izin kaydı');
    if (confirmed) {
      await this.leaveService.remove(item.id);
    }
  }
}
