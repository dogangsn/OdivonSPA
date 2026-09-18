import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Placeholder for modules not yet built out — keeps every sidebar route navigable during rollout. */
@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="flex flex-col items-center justify-center py-24 text-center">
      <div
        class="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5"
      >
        <mat-icon class="icon-size-8" [svgIcon]="icon()"></mat-icon>
      </div>
      <h2 class="text-xl font-black text-slate-900 dark:text-white tracking-tight">{{ title() }}</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm">Bu modül yakında burada olacak.</p>
    </div>
  `,
})
export class ComingSoon {
  readonly title = input<string>('Yakında');
  readonly icon = input<string>('heroicons_outline:sparkles');
}
