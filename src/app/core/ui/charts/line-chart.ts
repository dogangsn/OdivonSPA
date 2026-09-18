import { Component, input } from '@angular/core';
import { ApexAxisChartSeries, NgxApexchartsModule } from 'ngx-apexcharts';

/** Gradient area/line chart matching the "Son 7 Gün — Gelir/Gider" / "Günlük Prim Trendi" mockup style. */
@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [NgxApexchartsModule],
  template: `
    <apx-chart
      [series]="series()"
      [chart]="{ type: 'area', height: height(), fontFamily: 'Plus Jakarta Sans, sans-serif', toolbar: { show: false } }"
      [xaxis]="{ categories: categories(), labels: { style: { fontSize: '11px' } } }"
      [yaxis]="{ labels: { style: { fontSize: '11px' } } }"
      [colors]="colors()"
      [stroke]="{ curve: 'smooth', width: 2 }"
      [dataLabels]="{ enabled: false }"
      [fill]="{ type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.02 } }"
      [legend]="{ show: series().length > 1, position: 'top', fontSize: '12px' }"
      [grid]="{ borderColor: 'rgba(148,163,184,0.2)', strokeDashArray: 4 }"
    ></apx-chart>
  `,
})
export class LineChart {
  readonly series = input.required<ApexAxisChartSeries>();
  readonly categories = input.required<string[]>();
  readonly colors = input<string[]>(['#22c55e', '#f43f5e']);
  readonly height = input<number>(260);
}
