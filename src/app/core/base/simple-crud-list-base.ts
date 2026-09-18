import { Signal, computed, signal } from '@angular/core';
import { WithId } from '../models';

/**
 * Shared behaviour for every CRUD list screen in the app: live search, sort, pagination and
 * batch selection over a reactive `items` signal (typically `SomeService.watchAllSignal()`).
 * Feature list components extend this and only need to provide `items` + `matchesSearch`.
 */
export abstract class SimpleCrudListBase<T extends object> {
  abstract readonly items: Signal<WithId<T>[]>;

  readonly searchQuery = signal('');
  readonly sortKey = signal<keyof T | null>(null);
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());

  /** Override to control which fields free-text search matches against. */
  protected matchesSearch(_item: WithId<T>, _query: string): boolean {
    return true;
  }

  readonly filtered = computed<WithId<T>[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    let list = this.items();

    if (query) {
      list = list.filter((item) => this.matchesSearch(item, query));
    }

    const key = this.sortKey();
    if (key) {
      const dir = this.sortDir() === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av == null && bv == null) return 0;
        if (av == null) return -1 * dir;
        if (bv == null) return 1 * dir;
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }

    return list;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));

  readonly paged = computed<WithId<T>[]>(() => {
    const currentPage = Math.min(this.page(), this.totalPages());
    const size = this.pageSize();
    const start = (currentPage - 1) * size;
    return this.filtered().slice(start, start + size);
  });

  readonly selectedCount = computed(() => this.selectedIds().size);

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  toggleSort(key: keyof T): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  goToPage(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedIds.set(next);
  }

  toggleSelectAllVisible(): void {
    const visibleIds = this.paged().map((item) => item.id);
    const allSelected = visibleIds.every((id) => this.isSelected(id));
    const next = new Set(this.selectedIds());
    if (allSelected) {
      visibleIds.forEach((id) => next.delete(id));
    } else {
      visibleIds.forEach((id) => next.add(id));
    }
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }
}
