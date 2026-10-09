import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type KpiAccent = 'indigo' | 'emerald' | 'rose' | 'sky' | 'amber' | 'purple';

const ACCENT_CLASSES: Record<KpiAccent, { iconBg: string; iconText: string; valueText: string; dot: string }> = {
  indigo: {
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    valueText: 'text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500',
  },
  emerald: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    valueText: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  rose: {
    iconBg: 'bg-rose-50 dark:bg-rose-950/60',
    iconText: 'text-rose-600 dark:text-rose-400',
    valueText: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  sky: {
    iconBg: 'bg-sky-50 dark:bg-sky-950/60',
    iconText: 'text-sky-600 dark:text-sky-400',
    valueText: 'text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500',
  },
  amber: {
    iconBg: 'bg-amber-50 dark:bg-amber-950/60',
    iconText: 'text-amber-600 dark:text-amber-400',
    valueText: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  purple: {
    iconBg: 'bg-purple-50 dark:bg-purple-950/60',
    iconText: 'text-purple-600 dark:text-purple-400',
    valueText: 'text-purple-600 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
};

/**
 * Executive KPI card per `references/kpi-cards.md`. `size="md"` shrinks the number for dense grids
 * (e.g. currency values); the footer row shows `footerLeft` / `footerRight`, or any `[footer]` content.
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './kpi-card.html',
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly valueSuffix = input<string>('');
  readonly subLabel = input<string>('');
  readonly icon = input<string>('heroicons_solid:chart-bar');
  readonly accent = input<KpiAccent>('indigo');
  readonly size = input<'lg' | 'md'>('lg');
  readonly footerLeft = input<string>('');
  readonly footerRight = input<string>('');
  /** Shows a pulsing dot before `footerRight` for live-updating metrics. */
  readonly live = input<boolean>(false);

  get classes() {
    return ACCENT_CLASSES[this.accent()];
  }
}
