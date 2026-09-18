import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="max-w-sm mx-auto flex flex-col items-center py-16 text-center">
      <div
        class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-4"
      >
        <mat-icon class="icon-size-8" [svgIcon]="icon()"></mat-icon>
      </div>
      <h4 class="text-base font-bold text-slate-900 dark:text-white">{{ title() }}</h4>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">{{ description() }}</p>
      <ng-content></ng-content>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input<string>('heroicons_outline:folder-open');
  readonly title = input<string>('Henüz Kayıt Bulunamadı');
  readonly description = input<string>('Yeni bir kayıt oluşturarak hemen başlayabilirsiniz.');
}
