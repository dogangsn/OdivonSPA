import { Component, Signal, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SimpleCrudListBase } from '../../core/base/simple-crud-list-base';
import { EmptyState } from '../../core/ui/empty-state/empty-state';
import { Pagination } from '../../core/ui/pagination/pagination';
import { SlideOverDrawer } from '../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge } from '../../core/ui/status-badge/status-badge';
import { ConfirmService } from '../../core/ui/confirm/confirm.service';
import { Customer, CustomerGender, WithId } from '../../core/models';
import { CustomerService } from './customer.service';

interface CustomerForm {
  ad: string;
  telefon: string;
  email: string;
  cinsiyet: CustomerGender;
  kaynak: string;
  etiketlerText: string;
  saglikNotu: string;
  kvkkOnay: boolean;
}

const EMPTY_FORM: CustomerForm = {
  ad: '',
  telefon: '',
  email: '',
  cinsiyet: 'belirtilmedi',
  kaynak: '',
  etiketlerText: '',
  saglikNotu: '',
  kvkkOnay: false,
};

@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [FormsModule, RouterLink, MatIconModule, EmptyState, Pagination, SlideOverDrawer, StatusBadge],
  templateUrl: './customers-list.html',
})
export class CustomersList extends SimpleCrudListBase<Customer> {
  private readonly customerService = inject(CustomerService);
  private readonly confirmService = inject(ConfirmService);

  readonly items: Signal<WithId<Customer>[]> = this.customerService.watchAllSignal();

  readonly drawerOpen = signal(false);
  readonly isEditing = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  form: CustomerForm = { ...EMPTY_FORM };

  protected override matchesSearch(item: WithId<Customer>, query: string): boolean {
    return item.ad.toLowerCase().includes(query) || item.telefon.toLowerCase().includes(query);
  }

  openCreateDrawer(): void {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM };
    this.drawerOpen.set(true);
  }

  openEditDrawer(item: WithId<Customer>): void {
    this.isEditing.set(true);
    this.editingId.set(item.id);
    this.form = {
      ad: item.ad,
      telefon: item.telefon,
      email: item.email ?? '',
      cinsiyet: item.cinsiyet,
      kaynak: item.kaynak ?? '',
      etiketlerText: item.etiketler.join(', '),
      saglikNotu: item.saglikNotu ?? '',
      kvkkOnay: item.kvkkOnay,
    };
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  async save(): Promise<void> {
    if (!this.form.ad.trim() || !this.form.telefon.trim()) return;
    this.saving.set(true);
    try {
      const payload = {
        ad: this.form.ad.trim(),
        telefon: this.form.telefon.trim(),
        email: this.form.email.trim() || undefined,
        cinsiyet: this.form.cinsiyet,
        kaynak: this.form.kaynak.trim() || undefined,
        etiketler: this.form.etiketlerText
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        saglikNotu: this.form.saglikNotu.trim() || undefined,
        kvkkOnay: this.form.kvkkOnay,
        active: true,
      };

      if (this.isEditing() && this.editingId()) {
        await this.customerService.update(this.editingId()!, payload);
      } else {
        await this.customerService.create(payload as Omit<Customer, 'id'>);
      }
      this.closeDrawer();
    } finally {
      this.saving.set(false);
    }
  }

  async togglePassive(item: WithId<Customer>): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: item.active ? 'Müşteriyi Pasifleştir' : 'Müşteriyi Aktifleştir',
      text: `"${item.ad}" ${item.active ? 'pasifleştirilecek' : 'yeniden aktifleştirilecek'}.`,
    });
    if (confirmed) {
      await this.customerService.setActive(item.id, !item.active);
    }
  }
}
