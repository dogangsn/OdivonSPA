import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { VersionService } from '../../core/version/version.service';
import { NotificationService, AppNotification } from '../../core/services/notification.service';
import { Logo } from '../../core/ui/logo/logo';
import { NAV_GROUPS } from './nav-items';
import { STAFF_ROLE_LABELS } from '../../core/models';

export type { AppNotification };

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    Logo,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly STORAGE_KEY_COLLAPSED = 'odivon_collapsed_menu_groups_v3';
  private readonly STORAGE_KEY_SIDEBAR = 'odivon_desktop_sidebar_visible';

  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly version = inject(VersionService);
  private readonly notifService = inject(NotificationService);

  readonly sidebarOpen = signal(false);
  readonly desktopSidebarVisible = signal<boolean>(this.loadDesktopSidebarState());
  readonly collapsedGroups = signal<string[]>(this.loadCollapsedGroups());

  readonly loggingOut = signal(false);
  readonly roleLabels = STAFF_ROLE_LABELS;

  // Search state
  readonly searchQuery = signal('');
  readonly searchFocused = signal(false);

  // Live notifications state
  readonly notifications = this.notifService.notifications;
  readonly unreadCount = this.notifService.unreadCount;

  readonly visibleGroups = computed(() => {
    const role = this.auth.role();
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || (role && item.roles.includes(role))),
    })).filter((group) => group.items.length > 0);
  });

  readonly searchResults = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return [];
    const role = this.auth.role();
    const results: { label: string; route: string; group: string; icon: string }[] = [];

    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.roles && (!role || !item.roles.includes(role))) continue;
        if (item.label.toLowerCase().includes(q) || group.title.toLowerCase().includes(q)) {
          results.push({
            label: item.label,
            route: item.route,
            group: group.title,
            icon: item.icon,
          });
        }
      }
    }
    return results.slice(0, 8);
  });

  readonly userEmail = computed(() => this.auth.user()?.email ?? '');
  readonly userName = computed(() => {
    const user = this.auth.user();
    return user?.displayName?.trim() || user?.email?.split('@')[0] || 'Kullanıcı';
  });
  readonly userInitials = computed(() => {
    const email = this.userEmail();
    return email ? email.slice(0, 2).toUpperCase() : 'SP';
  });
  readonly userRoleLabel = computed(() => {
    const role = this.auth.role();
    return role ? this.roleLabels[role] : 'Personel';
  });

  readonly allGroupsExpanded = computed(() => this.collapsedGroups().length === 0);

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this.expandGroupForRoute(e.urlAfterRedirects || e.url);
      });

    // Expand the active group on initial load
    this.expandGroupForRoute(this.router.url);
  }

  private getStorage(): Storage | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
      if (typeof localStorage !== 'undefined' && localStorage) {
        return localStorage;
      }
    } catch {}
    return null;
  }

  private getDefaultCollapsedGroups(): string[] {
    return NAV_GROUPS.map((g) => g.title).filter((title) => title !== 'GENEL');
  }

  private loadCollapsedGroups(): string[] {
    try {
      const storage = this.getStorage();
      if (!storage) return this.getDefaultCollapsedGroups();
      const stored = storage.getItem(this.STORAGE_KEY_COLLAPSED);
      if (!stored) {
        return this.getDefaultCollapsedGroups();
      }
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : this.getDefaultCollapsedGroups();
    } catch {
      return this.getDefaultCollapsedGroups();
    }
  }

  private loadDesktopSidebarState(): boolean {
    try {
      const storage = this.getStorage();
      if (!storage) return true;
      const stored = storage.getItem(this.STORAGE_KEY_SIDEBAR);
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  }

  private saveCollapsedGroups(groups: string[]): void {
    try {
      this.getStorage()?.setItem(this.STORAGE_KEY_COLLAPSED, JSON.stringify(groups));
    } catch {}
  }

  isGroupExpanded(title: string): boolean {
    return !this.collapsedGroups().includes(title);
  }

  toggleGroup(title: string): void {
    this.collapsedGroups.update((collapsed) => {
      const next = collapsed.includes(title)
        ? collapsed.filter((t) => t !== title)
        : [...collapsed, title];
      this.saveCollapsedGroups(next);
      return next;
    });
  }

  collapseAllGroups(): void {
    const allTitles = this.visibleGroups().map((g) => g.title);
    this.collapsedGroups.set(allTitles);
    this.saveCollapsedGroups(allTitles);
  }

  expandAllGroups(): void {
    this.collapsedGroups.set([]);
    this.saveCollapsedGroups([]);
  }

  private isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.sidebarOpen.set(!this.sidebarOpen());
    } else {
      this.desktopSidebarVisible.update((visible) => {
        const next = !visible;
        try {
          this.getStorage()?.setItem(this.STORAGE_KEY_SIDEBAR, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  private expandGroupForRoute(url: string): void {
    if (!url) return;
    const cleanUrl = url.split('?')[0].split('#')[0];
    for (const group of NAV_GROUPS) {
      if (group.items.some((item) => cleanUrl.startsWith(item.route))) {
        if (this.collapsedGroups().includes(group.title)) {
          this.collapsedGroups.update((collapsed) => {
            const next = collapsed.filter((t) => t !== group.title);
            this.saveCollapsedGroups(next);
            return next;
          });
        }
        break;
      }
    }
  }

  onSearchFocus(): void {
    this.searchFocused.set(true);
  }

  onSearchBlur(): void {
    // Delay hiding dropdown so click can register
    setTimeout(() => {
      this.searchFocused.set(false);
    }, 200);
  }

  navigateToRoute(route: string): void {
    this.router.navigateByUrl(route);
    this.searchQuery.set('');
    this.searchFocused.set(false);
  }

  markAllNotificationsAsRead(): void {
    this.notifService.markAllAsRead();
  }

  markNotificationAsRead(id: string): void {
    this.notifService.markAsRead(id);
  }

  onNotificationClick(item: AppNotification): void {
    this.notifService.markAsRead(item.id);
    if (item.route) {
      this.router.navigateByUrl(item.route);
    }
  }

  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    try {
      await this.auth.logout();
    } catch (error) {
      console.error('Oturum kapatılırken hata oluştu.', error);
    } finally {
      const navigated = await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
      if (!navigated && typeof window !== 'undefined') {
        window.location.assign('/auth/login');
      }
      this.loggingOut.set(false);
    }
  }
}
