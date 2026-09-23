import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { Logo } from '../../core/ui/logo/logo';
import { NAV_GROUPS } from './nav-items';
import { STAFF_ROLE_LABELS } from '../../core/models';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, Logo],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly sidebarOpen = signal(false);
  readonly loggingOut = signal(false);
  readonly roleLabels = STAFF_ROLE_LABELS;

  readonly visibleGroups = computed(() => {
    const role = this.auth.role();
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || (role && item.roles.includes(role))),
    })).filter((group) => group.items.length > 0);
  });

  readonly userEmail = computed(() => this.auth.user()?.email ?? '');
  readonly userInitials = computed(() => {
    const email = this.userEmail();
    return email ? email.slice(0, 2).toUpperCase() : '?';
  });
  readonly userRoleLabel = computed(() => {
    const role = this.auth.role();
    return role ? this.roleLabels[role] : '';
  });

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    try {
      await this.auth.logout();
    } catch (error) {
      // Navigation must still happen when a stale network/auth state rejects sign-out.
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
