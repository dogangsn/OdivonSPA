import { Injectable, signal, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'odivon-spa-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('system');
  readonly isDark = signal<boolean>(false);

  private mediaQuery?: MediaQueryList;
  private mediaListener?: (e: MediaQueryListEvent) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaListener = (e: MediaQueryListEvent) => {
        if (this.mode() === 'system') {
          this.applyTheme(e.matches);
        }
      };
      this.mediaQuery.addEventListener('change', this.mediaListener);

      const savedMode = this.readStoredMode();
      this.setMode(savedMode);
    }
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore quota or disabled localStorage
    }

    if (mode === 'dark') {
      this.applyTheme(true);
    } else if (mode === 'light') {
      this.applyTheme(false);
    } else {
      const prefersDark = this.mediaQuery ? this.mediaQuery.matches : false;
      this.applyTheme(prefersDark);
    }
  }

  toggle(): void {
    // If currently dark, switch to light; if currently light, switch to dark
    const nextMode: ThemeMode = this.isDark() ? 'light' : 'dark';
    this.setMode(nextMode);
  }

  private readStoredMode(): ThemeMode {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      if (val === 'light' || val === 'dark' || val === 'system') {
        return val;
      }
    } catch {
      // Fallback
    }
    return 'system';
  }

  private applyTheme(dark: boolean): void {
    this.isDark.set(dark);
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }
}
