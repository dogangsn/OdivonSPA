import { Component, Signal, computed, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SimpleCrudListBase } from '../../../core/base/simple-crud-list-base';
import { EmptyState } from '../../../core/ui/empty-state/empty-state';
import { Pagination } from '../../../core/ui/pagination/pagination';
import { FirestoreDatePipe } from '../../../core/pipes/firestore-date.pipe';
import { AuditLog, WithId } from '../../../core/models';
import { AuditLogService } from './audit-log.service';

const ACTION_LABELS: Record<AuditLog['action'], string> = {
  create: 'Oluşturma',
  update: 'Güncelleme',
  delete: 'Silme',
  callable: 'Sistem İşlemi',
};

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [FormsModule, FirestoreDatePipe, JsonPipe, MatIconModule, EmptyState, Pagination],
  templateUrl: './audit-log.html',
})
export class AuditLogPage extends SimpleCrudListBase<AuditLog> {
  private readonly auditLogService = inject(AuditLogService);

  readonly actionLabels = ACTION_LABELS;
  readonly items: Signal<WithId<AuditLog>[]> = this.auditLogService.watchAllSignal();

  readonly filterEntity = signal('');
  readonly filterAction = signal<AuditLog['action'] | ''>('');
  readonly filterUserEmail = signal('');

  readonly entities = computed(() => [...new Set(this.items().map((i) => i.entity))].sort());

  readonly expandedId = signal<string | null>(null);

  /** Combines free-text search with the entity/action/user dropdown filters (the base class only
   *  applies `matchesSearch` when there's a text query, which isn't enough here). */
  override readonly filtered = computed<WithId<AuditLog>[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const entity = this.filterEntity();
    const action = this.filterAction();
    const userEmail = this.filterUserEmail().trim().toLowerCase();

    return this.items().filter((item) => {
      if (entity && item.entity !== entity) return false;
      if (action && item.action !== action) return false;
      if (userEmail && !item.userEmail.toLowerCase().includes(userEmail)) return false;
      if (query && !item.entityId.toLowerCase().includes(query) && !item.userEmail.toLowerCase().includes(query)) return false;
      return true;
    });
  });

  resetFilters(): void {
    this.filterEntity.set('');
    this.filterAction.set('');
    this.filterUserEmail.set('');
    this.searchQuery.set('');
    this.page.set(1);
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }
}
