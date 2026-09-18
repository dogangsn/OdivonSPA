import { Component, Signal, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { MatIconModule } from '@angular/material/icon';
import { SimpleCrudListBase } from '../../../core/base/simple-crud-list-base';
import { EmptyState } from '../../../core/ui/empty-state/empty-state';
import { FirestoreDatePipe } from '../../../core/pipes/firestore-date.pipe';
import { SlideOverDrawer } from '../../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge } from '../../../core/ui/status-badge/status-badge';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LEAVE_TYPE_LABELS, LeaveType, StaffLeave, WithId } from '../../../core/models';
import { LeaveService } from './leave.service';
import { StaffService } from '../personnel/staff.service';

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
  imports: [FormsModule, FirestoreDatePipe, MatIconModule, EmptyState, SlideOverDrawer, StatusBadge],
  templateUrl: './leaves-list.html',
})
export class LeavesList extends SimpleCrudListBase<StaffLeave> {
  private readonly leaveService = inject(LeaveService);
  private readonly confirmService = inject(ConfirmService);
  private readonly staffService = inject(StaffService);
  private readonly auth = inject(AuthService);

  readonly leaveTypeLabels = LEAVE_TYPE_LABELS;
  readonly leaveTypes: LeaveType[] = ['yillik', 'rapor', 'ucretsiz', 'diger'];

  readonly items: Signal<WithId<StaffLeave>[]> = this.leaveService.watchAllSignal();
  readonly staff = this.staffService.watchAllSignal();
  readonly staffNameById = computed(() => new Map(this.staff().map((s) => [s.id, s.ad])));

  readonly drawerOpen = signal(false);
  readonly saving = signal(false);
  form: LeaveForm = { staffId: '', type: 'yillik', startDate: '', endDate: '', note: '' };

  openCreateDrawer(): void {
    const isAdmin = this.auth.isAdmin();
    this.form = {
      staffId: isAdmin ? '' : this.auth.user()?.uid ?? '',
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
    this.saving.set(true);
    try {
      await this.leaveService.create({
        staffId: this.form.staffId,
        type: this.form.type,
        startDate: Timestamp.fromDate(new Date(this.form.startDate)),
        endDate: Timestamp.fromDate(new Date(this.form.endDate)),
        note: this.form.note.trim() || undefined,
      } as Omit<StaffLeave, 'id'>);
      this.closeDrawer();
    } finally {
      this.saving.set(false);
    }
  }

  async remove(item: WithId<StaffLeave>): Promise<void> {
    const confirmed = await this.confirmService.confirmDelete('izin kaydı');
    if (confirmed) {
      await this.leaveService.remove(item.id);
    }
  }
}
