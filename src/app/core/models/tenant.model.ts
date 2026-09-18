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

/** Mirrors the custom claims Cloud Functions set on the Firebase Auth token. */
export interface TenantClaims {
  tenantId: string;
  role: 'admin' | 'reception' | 'therapist';
}
