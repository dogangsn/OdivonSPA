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
import { Product, STOCK_MOVEMENT_TYPE_LABELS, StockMovementType, WithId } from '../../../core/models';
import { ProductService } from './product.service';

interface ProductForm {
  sku: string;
  ad: string;
  fiyat: number;
  kritikStokSeviyesi: number;
  mevcutStok: number;
}

const EMPTY_FORM: ProductForm = { sku: '', ad: '', fiyat: 0, kritikStokSeviyesi: 5, mevcutStok: 0 };

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [FormsModule, DecimalPipe, MatIconModule, EmptyState, Pagination, SlideOverDrawer, StatusBadge],
  templateUrl: './products-list.html',
})
export class ProductsList extends SimpleCrudListBase<Product> {
  private readonly productService = inject(ProductService);
  private readonly confirmService = inject(ConfirmService);

  readonly items: Signal<WithId<Product>[]> = this.productService.watchAllSignal();
  readonly criticalCount = () => this.items().filter((p) => p.mevcutStok <= p.kritikStokSeviyesi).length;

  readonly movementTypeLabels = STOCK_MOVEMENT_TYPE_LABELS;

  readonly drawerOpen = signal(false);
  readonly isEditing = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  form: ProductForm = { ...EMPTY_FORM };

  readonly movementDrawerOpen = signal(false);
  readonly movementTarget = signal<WithId<Product> | null>(null);
  readonly movementType = signal<StockMovementType>('giris');
  readonly movementQty = signal<number>(1);
  readonly movementNote = signal<string>('');
  readonly movementSaving = signal(false);

  protected override matchesSearch(item: WithId<Product>, query: string): boolean {
    return item.ad.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query);
  }

  openCreateDrawer(): void {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM };
    this.drawerOpen.set(true);
  }

  openEditDrawer(item: WithId<Product>): void {
    this.isEditing.set(true);
    this.editingId.set(item.id);
    this.form = { sku: item.sku, ad: item.ad, fiyat: item.fiyat, kritikStokSeviyesi: item.kritikStokSeviyesi, mevcutStok: item.mevcutStok };
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  async save(): Promise<void> {
    if (!this.form.ad.trim() || !this.form.sku.trim()) return;
    this.saving.set(true);
    try {
      const payload = {
        sku: this.form.sku.trim(),
        ad: this.form.ad.trim(),
        fiyat: this.form.fiyat,
        kritikStokSeviyesi: this.form.kritikStokSeviyesi,
        mevcutStok: this.form.mevcutStok,
        active: true,
      };
      if (this.isEditing() && this.editingId()) {
        await this.productService.update(this.editingId()!, payload);
      } else {
        await this.productService.create(payload as Omit<Product, 'id'>);
      }
      this.closeDrawer();
    } finally {
      this.saving.set(false);
    }
  }

  async togglePassive(item: WithId<Product>): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: item.active ? 'Ürünü Pasifleştir' : 'Ürünü Aktifleştir',
      text: `"${item.ad}" ${item.active ? 'pasifleştirilecek' : 'yeniden aktifleştirilecek'}.`,
    });
    if (confirmed) {
      await this.productService.setActive(item.id, !item.active);
    }
  }

  openMovementDrawer(item: WithId<Product>): void {
    this.movementTarget.set(item);
    this.movementType.set('giris');
    this.movementQty.set(1);
    this.movementNote.set('');
    this.movementDrawerOpen.set(true);
  }

  closeMovementDrawer(): void {
    this.movementDrawerOpen.set(false);
  }

  async saveMovement(): Promise<void> {
    const target = this.movementTarget();
    if (!target) return;
    this.movementSaving.set(true);
    try {
      const type = this.movementType();
      // "Sayım" records the freshly counted total — the logged movement is the delta needed to reach it.
      const signedDelta =
        type === 'sayim'
          ? this.movementQty() - target.mevcutStok
          : type === 'fire'
            ? -Math.abs(this.movementQty())
            : Math.abs(this.movementQty());

      if (signedDelta === 0) {
        this.closeMovementDrawer();
        return;
      }

      await this.productService.recordStockMovement(target.id, type, signedDelta, this.movementNote().trim() || undefined);
      this.closeMovementDrawer();
    } catch (err) {
      await this.confirmService.error('Stok Hareketi Kaydedilemedi', err instanceof Error ? err.message : undefined);
    } finally {
      this.movementSaving.set(false);
    }
  }
}
