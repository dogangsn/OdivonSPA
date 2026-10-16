import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_COOKIE_NAME = 'odivon_theme';
export const THEME_STORAGE_KEY = 'odivon-spa-theme';

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + encodeURIComponent(name) + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
}

export function removeCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('light');
  readonly isDark = signal<boolean>(false);

  private mediaQuery?: MediaQueryList;
  private mediaListener?: (e: MediaQueryListEvent) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      if (typeof window.matchMedia === 'function') {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.mediaListener = (e: MediaQueryListEvent) => {
          if (this.mode() === 'system') {
            this.applyTheme(e.matches);
          }
        };
        this.mediaQuery.addEventListener?.('change', this.mediaListener);
      }

      const savedMode = this.readStoredMode();
      this.setMode(savedMode);
    }
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    setCookie(THEME_COOKIE_NAME, mode, 365);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
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
    // 1. Try reading from cookie first
    const cookieVal = getCookie(THEME_COOKIE_NAME);
    if (cookieVal === 'light' || cookieVal === 'dark' || cookieVal === 'system') {
      return cookieVal;
    }

    // 2. Fallback to localStorage and migrate to cookie
    try {
      const storageVal = localStorage.getItem(THEME_STORAGE_KEY);
      if (storageVal === 'light' || storageVal === 'dark' || storageVal === 'system') {
        setCookie(THEME_COOKIE_NAME, storageVal, 365);
        return storageVal;
      }
    } catch {
      // Fallback
    }
    return 'light';
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
