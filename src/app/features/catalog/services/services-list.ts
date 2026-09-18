import { Component, Signal, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SimpleCrudListBase } from '../../../core/base/simple-crud-list-base';
import { EmptyState } from '../../../core/ui/empty-state/empty-state';
import { Pagination } from '../../../core/ui/pagination/pagination';
import { SlideOverDrawer } from '../../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge } from '../../../core/ui/status-badge/status-badge';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { Service, WithId } from '../../../core/models';
import { CatalogServiceService } from './catalog-service.service';

interface ServiceForm {
  ad: string;
  tur: string;
  kategori: string;
  sureDk: number;
  fiyat: number;
}

const EMPTY_FORM: ServiceForm = { ad: '', tur: '', kategori: '', sureDk: 45, fiyat: 0 };

@Component({
  selector: 'app-services-list',
  standalone: true,
  imports: [FormsModule, MatIconModule, DecimalPipe, EmptyState, Pagination, SlideOverDrawer, StatusBadge],
  templateUrl: './services-list.html',
})
export class ServicesList extends SimpleCrudListBase<Service> {
  private readonly serviceService = inject(CatalogServiceService);
  private readonly confirmService = inject(ConfirmService);

  readonly items: Signal<WithId<Service>[]> = this.serviceService.watchAllSignal();

  readonly drawerOpen = signal(false);
  readonly isEditing = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  form: ServiceForm = { ...EMPTY_FORM };

  protected override matchesSearch(item: WithId<Service>, query: string): boolean {
    return item.ad.toLowerCase().includes(query) || item.kategori.toLowerCase().includes(query);
  }

  openCreateDrawer(): void {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM };
    this.drawerOpen.set(true);
  }

  openEditDrawer(item: WithId<Service>): void {
    this.isEditing.set(true);
    this.editingId.set(item.id);
    this.form = { ad: item.ad, tur: item.tur, kategori: item.kategori, sureDk: item.sureDk, fiyat: item.fiyat };
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  async save(): Promise<void> {
    if (!this.form.ad.trim()) return;
    this.saving.set(true);
    try {
      const payload = {
        ad: this.form.ad.trim(),
        tur: this.form.tur.trim() || this.form.kategori.trim(),
        kategori: this.form.kategori.trim(),
        sureDk: this.form.sureDk,
        fiyat: this.form.fiyat,
        uygunStaffIds: [] as string[],
        active: true,
      };
      if (this.isEditing() && this.editingId()) {
        await this.serviceService.update(this.editingId()!, payload);
      } else {
        await this.serviceService.create(payload as Omit<Service, 'id'>);
      }
      this.closeDrawer();
    } finally {
      this.saving.set(false);
    }
  }

  async togglePassive(item: WithId<Service>): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: item.active ? 'Hizmeti Pasifleştir' : 'Hizmeti Aktifleştir',
      text: `"${item.ad}" ${item.active ? 'pasifleştirilecek' : 'yeniden aktifleştirilecek'}.`,
    });
    if (confirmed) {
      await this.serviceService.setActive(item.id, !item.active);
    }
  }
}
