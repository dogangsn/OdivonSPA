import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type KpiAccent = 'indigo' | 'emerald' | 'rose' | 'sky' | 'amber' | 'purple';

const ACCENT_CLASSES: Record<KpiAccent, { iconBg: string; iconText: string; valueText: string }> = {
  indigo: {
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    valueText: 'text-indigo-600 dark:text-indigo-400',
  },
  emerald: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    valueText: 'text-emerald-600 dark:text-emerald-400',
  },
  rose: {
    iconBg: 'bg-rose-50 dark:bg-rose-950/60',
    iconText: 'text-rose-600 dark:text-rose-400',
    valueText: 'text-rose-600 dark:text-rose-400',
  },
  sky: {
    iconBg: 'bg-sky-50 dark:bg-sky-950/60',
    iconText: 'text-sky-600 dark:text-sky-400',
    valueText: 'text-sky-600 dark:text-sky-400',
  },
  amber: {
    iconBg: 'bg-amber-50 dark:bg-amber-950/60',
    iconText: 'text-amber-600 dark:text-amber-400',
    valueText: 'text-amber-600 dark:text-amber-400',
  },
  purple: {
    iconBg: 'bg-purple-50 dark:bg-purple-950/60',
    iconText: 'text-purple-600 dark:text-purple-400',
    valueText: 'text-purple-600 dark:text-purple-400',
  },
};

/** Executive KPI card per `references/kpi-cards.md`. Footer is optional free-form content. */
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

  get classes() {
    return ACCENT_CLASSES[this.accent()];
  }
}
