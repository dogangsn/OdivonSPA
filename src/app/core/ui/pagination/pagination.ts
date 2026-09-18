import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (totalPages() > 1) {
      <div class="flex items-center justify-between px-6 py-3.5 border-t border-slate-200/80 dark:border-slate-800">
        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
          Sayfa {{ page() }} / {{ totalPages() }}
        </span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            [disabled]="page() <= 1"
            (click)="pageChange.emit(page() - 1)"
            class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
          >
            <mat-icon class="icon-size-4" [svgIcon]="'heroicons_outline:chevron-left'"></mat-icon>
          </button>
          <button
            type="button"
            [disabled]="page() >= totalPages()"
            (click)="pageChange.emit(page() + 1)"
            class="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
          >
            <mat-icon class="icon-size-4" [svgIcon]="'heroicons_outline:chevron-right'"></mat-icon>
          </button>
        </div>
      </div>
    }
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();
}
