import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { VersionService } from '../../core/version/version.service';
import { Logo } from '../../core/ui/logo/logo';
import { NAV_GROUPS } from './nav-items';
import { STAFF_ROLE_LABELS } from '../../core/models';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'warning' | 'success';
}

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
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly version = inject(VersionService);

  readonly sidebarOpen = signal(false);
  readonly loggingOut = signal(false);
  readonly roleLabels = STAFF_ROLE_LABELS;

  // Search state
  readonly searchQuery = signal('');
  readonly searchFocused = signal(false);

  // Notifications state
  readonly notifications = signal<AppNotification[]>([
    {
      id: '1',
      title: 'Bugünkü Randevular',
      message: 'Bugün için planlanan seanslar takvime işlendi.',
      time: 'Az önce',
      read: false,
      type: 'info',
    },
    {
      id: '2',
      title: 'Kasa Güncellemesi',
      message: 'Günlük kasa açılışı tamamlandı, işlemler kaydedilebilir.',
      time: '1 saat önce',
      read: false,
      type: 'success',
    },
    {
      id: '3',
      title: 'Prim Tahakkuku',
      message: 'Onay bekleyen prim hak edişleri mevcut.',
      time: 'Dün',
      read: true,
      type: 'warning',
    },
  ]);

  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);

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

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
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
    this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
  }

  markNotificationAsRead(id: string): void {
    this.notifications.update((list) =>
      list.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
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
