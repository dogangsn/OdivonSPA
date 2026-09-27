import { FirestoreDate } from './common.model';

export interface Tenant {
  name: string;
  plan: 'trial' | 'standard' | 'pro';
  active: boolean;
  createdAt: FirestoreDate;
  settings?: {
    timezone?: string;
    currency?: string;
    workDayStart?: string; // "08:00"
    workDayEnd?: string; // "22:00"
  };
}

/** Tenant and spa role of the signed-in user, as returned by Main API `GET /spa/me`. */
export interface TenantClaims {
  tenantId: string;
  role: 'admin' | 'reception' | 'therapist';
}
