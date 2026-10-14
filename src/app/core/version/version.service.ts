import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { BUILD_INFO, BuildInfo } from './build-info';
import { compareVersions, PRESERVED_STORAGE_KEYS } from './version-compare';

const CHECK_INTERVAL_MS = 5 * 60_000;

@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly current: BuildInfo = BUILD_INFO;
  readonly available = signal<BuildInfo | null>(null);
  readonly applying = signal(false);
  private readonly forced = signal(false);

  readonly manualOpen = signal(false);
  readonly isChecking = signal(false);
  readonly lastCheckedAt = signal<Date | null>(null);

  /** A newer release is deployed: update is required */
  readonly updateRequired = computed(() => this.forced() || this.available() !== null);

  /** Modal is visible if an update is required or if opened manually for release info */
  readonly modalVisible = computed(() => this.updateRequired() || this.manualOpen());

  /** Critical release flag */
  readonly critical = computed(() => {
    const next = this.available();
    if (this.forced()) return true;
    if (!next) return false;
    return (
      next.forceLogout ||
      (!!next.minVersion && compareVersions(this.current.version, next.minVersion) < 0)
    );
  });

  openModal(): void {
    this.manualOpen.set(true);
  }

  closeModal(): void {
    this.manualOpen.set(false);
    this.available.set(null);
  }

  async checkNow(): Promise<void> {
    if (this.isChecking()) return;
    this.isChecking.set(true);
    try {
      await this.checkRemote();
      this.lastCheckedAt.set(new Date());
    } finally {
      this.isChecking.set(false);
    }
  }

  private started = false;

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    // Check immediately on app boot
    void this.checkRemote();

    // Check periodically every 5 minutes
    const timer = window.setInterval(() => void this.checkRemote(), CHECK_INTERVAL_MS);

    // Check when user tabs back into the browser
    const onVisible = () => {
      if (!document.hidden) void this.checkRemote();
    };
    document.addEventListener('visibilitychange', onVisible);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  forceUpdate(): void {
    this.forced.set(true);
    void this.checkRemote();
  }

  /**
   * Applies the release update:
   * 1. Signs out the user from auth
   * 2. Clears browser caches
   * 3. Clears local and session storage (except preserved settings like theme)
   * 4. Clears all cookies
   * 5. Redirects to /auth/login?updated=1
   */
  async applyUpdate(): Promise<void> {
    if (this.applying()) return;
    this.applying.set(true);
    try {
      await this.auth.logout().catch(() => undefined);
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys().catch(() => [] as string[]);
        await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
      }
      clearStorage();
      clearCookies();
    } finally {
      window.location.replace('/auth/login?updated=1');
    }
  }

  private async checkRemote(): Promise<void> {
    // Avoid blocking modal during local development unless opened manually
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      !this.manualOpen()
    ) {
      return;
    }

    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) return;
      const remote = (await response.json()) as BuildInfo;
      if (remote?.buildId && remote.buildId !== this.current.buildId) {
        this.available.set(remote);
      }
    } catch {
      // offline or version.json unreachable, retry on next interval
    }
  }
}

function clearStorage(): void {
  try {
    const kept = PRESERVED_STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)] as const);
    localStorage.clear();
    for (const [key, value] of kept) {
      if (value !== null) localStorage.setItem(key, value);
    }
    sessionStorage.clear();
  } catch {
    // Ignore private mode / blocked storage
  }
}

function clearCookies(): void {
  try {
    if (typeof document === 'undefined') return;
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
    }
  } catch {
    // Ignore error
  }
}
