import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { VersionService } from './core/version/version.service';
import { UpdateBanner } from './shared/components/update-banner/update-banner';

@Component({
  imports: [RouterOutlet, UpdateBanner],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly theme = inject(ThemeService);
  private readonly version = inject(VersionService);

  constructor() {
    this.version.start();
  }
}
