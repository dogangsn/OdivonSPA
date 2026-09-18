import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { StaffRole } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class StaffAdminService {
  private readonly functions = inject(Functions);

  async inviteStaffUser(input: { email: string; ad: string; role: StaffRole }): Promise<{ staffId: string; resetLink: string }> {
    const callable = httpsCallable<typeof input, { staffId: string; resetLink: string }>(this.functions, 'inviteStaffUser');
    const result = await callable(input);
    return result.data;
  }

  async setStaffRole(staffId: string, role: StaffRole): Promise<void> {
    const callable = httpsCallable<{ staffId: string; role: StaffRole }, { success: boolean }>(this.functions, 'setStaffRole');
    await callable({ staffId, role });
  }

  async deactivateStaffUser(staffId: string): Promise<void> {
    const callable = httpsCallable<{ staffId: string }, { success: boolean }>(this.functions, 'deactivateStaffUser');
    await callable({ staffId });
  }
}
