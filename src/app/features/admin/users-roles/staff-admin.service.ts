import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http/api.service';
import { StaffRole } from '../../../core/models';
import { DataRefreshService } from '../../../core/services/data-refresh.service';

@Injectable({ providedIn: 'root' })
export class StaffAdminService {
  private readonly api = inject(ApiService);
  private readonly refresh = inject(DataRefreshService);

  async inviteStaffUser(input: { email: string; ad: string; role: StaffRole }): Promise<{ staffId: string; resetLink: string }> {
    const result = await this.api.post<{ staffId: string; resetLink: string }>('/spa/staff/invite', input);
    this.refresh.notifyChanged();
    return result;
  }

  async setStaffRole(staffId: string, role: StaffRole): Promise<void> {
    await this.api.patch(`/spa/staff/${staffId}/role`, { role });
    this.refresh.notifyChanged();
  }

  async deactivateStaffUser(staffId: string): Promise<void> {
    await this.api.post(`/spa/staff/${staffId}/deactivate`);
    this.refresh.notifyChanged();
  }
}
