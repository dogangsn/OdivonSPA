import { Timestamp } from '@angular/fire/firestore';

/** Every Firestore document gets its `id` merged in by FirestoreCrudService. */
export type WithId<T> = T & { id: string };

export type FirestoreDate = Timestamp | Date;

export type PaymentMethod = 'nakit' | 'kart' | 'havale' | 'diger';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  nakit: 'Nakit',
  kart: 'Kredi Kartı',
  havale: 'Havale',
  diger: 'Diğer',
};

export type StaffRole = 'admin' | 'reception' | 'therapist';

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Yönetici',
  reception: 'Resepsiyon',
  therapist: 'Terapist',
};

export interface AuditMeta {
  createdAt: FirestoreDate;
  createdBy: string;
  updatedAt?: FirestoreDate;
  updatedBy?: string;
}
