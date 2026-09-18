import { Component, input } from '@angular/core';

/** The OdivonSPA brand mark (ring logo) — matches `public/favicon.svg`. */
@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="16" fill="#101828" />
      <ellipse cx="32" cy="32" rx="15" ry="19" transform="rotate(35 32 32)" fill="none" stroke="#917aff" stroke-width="10" />
    </svg>
  `,
})
export class Logo {
  readonly size = input<number>(36);
}
