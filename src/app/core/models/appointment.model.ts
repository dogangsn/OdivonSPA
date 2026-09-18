import { FirestoreDate } from './common.model';

export type AppointmentStatus = 'Bekliyor' | 'Onaylandı' | 'Geldi' | 'Tamamlandı' | 'Gelmedi' | 'İptal';

export const APPOINTMENT_STATUS_FLOW: AppointmentStatus[] = ['Bekliyor', 'Onaylandı', 'Geldi', 'Tamamlandı'];

export const APPOINTMENT_STATUS_BADGE: Record<AppointmentStatus, { bg: string; text: string; dot: string }> = {
  Bekliyor: { bg: 'bg-amber-50 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  Onaylandı: { bg: 'bg-sky-50 dark:bg-sky-950/60', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
  Geldi: { bg: 'bg-sky-50 dark:bg-sky-950/60', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
  Tamamlandı: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  Gelmedi: { bg: 'bg-rose-50 dark:bg-rose-950/60', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
  İptal: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-400' },
};

export interface Appointment {
  customerId: string;
  staffId: string;
  roomId: string;
  serviceId: string;
  start: FirestoreDate;
  end: FirestoreDate;
  status: AppointmentStatus;
  notes?: string;
  sessionId?: string; // set once converted to a POS session
  createdAt: FirestoreDate;
  createdBy: string;
}
