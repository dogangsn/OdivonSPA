import { Component, input } from '@angular/core';
import { ApexOptions, NgxApexchartsModule } from 'ngx-apexcharts';

/** Donut chart matching the "Ödeme Yöntemi Dağılımı" / "Ödenen Oranı" mockup style, with an optional center label. */
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [NgxApexchartsModule],
  template: `
    <div class="relative" [style.height.px]="height()">
      <apx-chart
        [series]="series()"
        [chart]="{ type: 'donut', height: height(), fontFamily: 'Plus Jakarta Sans, sans-serif' }"
        [labels]="labels()"
        [colors]="colors()"
        [legend]="{ show: showLegend(), position: 'bottom', fontSize: '12px' }"
        [dataLabels]="{ enabled: false }"
        [stroke]="{ width: 0 }"
        [plotOptions]="plotOptions"
      ></apx-chart>
      @if (centerValue()) {
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" [style.top.px]="showLegend() ? -28 : 0">
          <span class="text-2xl font-black text-slate-900 dark:text-white">{{ centerValue() }}</span>
          @if (centerLabel()) {
            <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{{ centerLabel() }}</span>
          }
        </div>
      }
    </div>
  `,
})
export class DonutChart {
  readonly series = input.required<number[]>();
  readonly labels = input.required<string[]>();
  readonly colors = input<string[]>(['#6366f1', '#22c55e', '#0ea5e9', '#f59e0b', '#f43f5e']);
  readonly height = input<number>(220);
  readonly showLegend = input<boolean>(true);
  readonly centerLabel = input<string>('');
  readonly centerValue = input<string>('');

  readonly plotOptions: ApexOptions['plotOptions'] = {
    pie: {
      donut: {
        size: '72%',
        labels: { show: false },
      },
    },
  };
}
