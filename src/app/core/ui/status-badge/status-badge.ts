import { Component, input } from '@angular/core';

export type BadgeVariant = 'emerald' | 'amber' | 'rose' | 'sky' | 'purple' | 'slate';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40',
  rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/40',
  sky: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/40',
  purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/40',
  slate: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border"
      [class]="VARIANT_CLASSES[variant()]"
    >
      @if (dot()) {
        <span class="w-1.5 h-1.5 rounded-full" [class]="dotClass()"></span>
      }
      {{ label() }}
    </span>
  `,
})
export class StatusBadge {
  readonly VARIANT_CLASSES = VARIANT_CLASSES;

  readonly label = input.required<string>();
  readonly variant = input<BadgeVariant>('slate');
  readonly dot = input<boolean>(false);

  dotClass(): string {
    const dotColors: Record<BadgeVariant, string> = {
      emerald: 'bg-emerald-500',
      amber: 'bg-amber-500',
      rose: 'bg-rose-500',
      sky: 'bg-sky-500',
      purple: 'bg-purple-500',
      slate: 'bg-slate-400',
    };
    return dotColors[this.variant()];
  }
}
