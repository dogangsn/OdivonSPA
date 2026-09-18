import { Component, Signal, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SimpleCrudListBase } from '../../../core/base/simple-crud-list-base';
import { EmptyState } from '../../../core/ui/empty-state/empty-state';
import { SlideOverDrawer } from '../../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge } from '../../../core/ui/status-badge/status-badge';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { Room, WithId } from '../../../core/models';
import { RoomService } from './room.service';

interface RoomForm {
  ad: string;
  kapasite: number;
}

@Component({
  selector: 'app-rooms-list',
  standalone: true,
  imports: [FormsModule, MatIconModule, EmptyState, SlideOverDrawer, StatusBadge],
  templateUrl: './rooms-list.html',
})
export class RoomsList extends SimpleCrudListBase<Room> {
  private readonly roomService = inject(RoomService);
  private readonly confirmService = inject(ConfirmService);

  readonly items: Signal<WithId<Room>[]> = this.roomService.watchAllSignal();

  readonly drawerOpen = signal(false);
  readonly isEditing = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  form: RoomForm = { ad: '', kapasite: 1 };

  protected override matchesSearch(item: WithId<Room>, query: string): boolean {
    return item.ad.toLowerCase().includes(query);
  }

  openCreateDrawer(): void {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.form = { ad: '', kapasite: 1 };
    this.drawerOpen.set(true);
  }

  openEditDrawer(item: WithId<Room>): void {
    this.isEditing.set(true);
    this.editingId.set(item.id);
    this.form = { ad: item.ad, kapasite: item.kapasite };
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  async save(): Promise<void> {
    if (!this.form.ad.trim()) return;
    this.saving.set(true);
    try {
      const payload = { ad: this.form.ad.trim(), kapasite: this.form.kapasite, active: true };
      if (this.isEditing() && this.editingId()) {
        await this.roomService.update(this.editingId()!, payload);
      } else {
        await this.roomService.create(payload as Omit<Room, 'id'>);
      }
      this.closeDrawer();
    } finally {
      this.saving.set(false);
    }
  }

  async togglePassive(item: WithId<Room>): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: item.active ? 'Odayı Pasifleştir' : 'Odayı Aktifleştir',
      text: `"${item.ad}" ${item.active ? 'pasifleştirilecek' : 'yeniden aktifleştirilecek'}.`,
    });
    if (confirmed) {
      await this.roomService.setActive(item.id, !item.active);
    }
  }
}
