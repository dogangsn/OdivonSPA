import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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
})
export class Shell {
  private readonly auth = inject(AuthService);

  readonly sidebarOpen = signal(false);
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
    await this.auth.logout();
  }
}
