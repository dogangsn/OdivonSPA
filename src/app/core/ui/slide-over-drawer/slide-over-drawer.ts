import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Generic slide-over drawer shell per `references/slideover-drawer.md`. Body/footer via content projection. */
@Component({
  selector: 'app-slide-over-drawer',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './slide-over-drawer.html',
  styleUrl: './slide-over-drawer.scss',
})
export class SlideOverDrawer {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly widthClass = input<string>('max-w-lg');

  readonly closed = output<void>();

  onBackdropClick(): void {
    this.closed.emit();
  }
}
