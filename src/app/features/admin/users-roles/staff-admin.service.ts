import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http/api.service';
import { StaffRole } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class StaffAdminService {
  private readonly api = inject(ApiService);

  async inviteStaffUser(input: { email: string; ad: string; role: StaffRole }): Promise<{ staffId: string; resetLink: string }> {
    return this.api.post('/api/staff/invite', input);
  }

  async setStaffRole(staffId: string, role: StaffRole): Promise<void> {
    await this.api.patch(`/api/staff/${staffId}/role`, { role });
  }

  async deactivateStaffUser(staffId: string): Promise<void> {
    await this.api.post(`/api/staff/${staffId}/deactivate`);
  }
}
