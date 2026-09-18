import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { SlideOverDrawer } from '../../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge } from '../../../core/ui/status-badge/status-badge';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { AuthService } from '../../../core/auth/auth.service';
import { STAFF_ROLE_LABELS, Staff, StaffRole, WithId } from '../../../core/models';
import { StaffService } from '../../staff/personnel/staff.service';
import { StaffAdminService } from './staff-admin.service';

interface InviteForm {
  ad: string;
  email: string;
  role: StaffRole;
}

@Component({
  selector: 'app-users-roles',
  standalone: true,
  imports: [FormsModule, MatIconModule, SlideOverDrawer, StatusBadge],
  templateUrl: './users-roles.html',
})
export class UsersRoles {
  private readonly staffService = inject(StaffService);
  private readonly staffAdminService = inject(StaffAdminService);
  private readonly confirmService = inject(ConfirmService);
  private readonly auth = inject(AuthService);

  readonly roleLabels = STAFF_ROLE_LABELS;
  readonly roles: StaffRole[] = ['admin', 'reception', 'therapist'];
  readonly staff = this.staffService.watchAllSignal();
  readonly currentUid = this.auth.user()?.uid;

  readonly inviteDrawerOpen = signal(false);
  readonly inviting = signal(false);
  readonly savingRoleFor = signal<string | null>(null);
  inviteForm: InviteForm = { ad: '', email: '', role: 'reception' };

  openInviteDrawer(): void {
    this.inviteForm = { ad: '', email: '', role: 'reception' };
    this.inviteDrawerOpen.set(true);
  }

  closeInviteDrawer(): void {
    this.inviteDrawerOpen.set(false);
  }

  async invite(): Promise<void> {
    if (!this.inviteForm.ad.trim() || !this.inviteForm.email.trim()) return;
    this.inviting.set(true);
    try {
      const result = await this.staffAdminService.inviteStaffUser({
        ad: this.inviteForm.ad.trim(),
        email: this.inviteForm.email.trim(),
        role: this.inviteForm.role,
      });
      this.closeInviteDrawer();
      await this.confirmService.success(
        'Kullanıcı Oluşturuldu',
        `Şifre belirleme bağlantısını ${this.inviteForm.email} adresine iletin:\n${result.resetLink}`,
      );
    } catch (err) {
      await this.confirmService.error('Kullanıcı Oluşturulamadı', err instanceof Error ? err.message : undefined);
    } finally {
      this.inviting.set(false);
    }
  }

  async changeRole(item: WithId<Staff>, role: StaffRole): Promise<void> {
    if (role === item.role) return;
    const confirmed = await this.confirmService.confirm({
      title: 'Rolü Değiştir',
      text: `"${item.ad}" için rol "${this.roleLabels[role]}" olarak değiştirilecek.`,
    });
    if (!confirmed) return;

    this.savingRoleFor.set(item.id);
    try {
      await this.staffAdminService.setStaffRole(item.id, role);
    } catch (err) {
      await this.confirmService.error('Rol Değiştirilemedi', err instanceof Error ? err.message : undefined);
    } finally {
      this.savingRoleFor.set(null);
    }
  }

  async resetPassword(item: WithId<Staff>): Promise<void> {
    const confirmed = await this.confirmService.confirm({ title: 'Şifre Sıfırlama E-postası Gönder', text: `${item.email} adresine gönderilecek.` });
    if (!confirmed) return;
    await this.auth.resetPassword(item.email);
    await this.confirmService.success('Gönderildi');
  }

  async deactivate(item: WithId<Staff>): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: 'Kullanıcıyı Pasifleştir',
      text: `"${item.ad}" hesabı devre dışı bırakılacak.`,
      danger: true,
      confirmText: 'Pasifleştir',
    });
    if (!confirmed) return;
    try {
      await this.staffAdminService.deactivateStaffUser(item.id);
    } catch (err) {
      await this.confirmService.error('Pasifleştirilemedi', err instanceof Error ? err.message : undefined);
    }
  }
}
