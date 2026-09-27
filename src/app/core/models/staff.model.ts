import { FirestoreDate, StaffRole } from './common.model';

/** Doc id == Firebase Auth uid. */
export interface Staff {
  ad: string;
  email: string;
  role: StaffRole;
  uzmanliklar: string[]; // service category tags this staff member can perform
  primOraniVarsayilan: number; // default commission %, used when no matching commissionRule
  iban?: string;
  telefon?: string;
  iseGirisTarihi?: FirestoreDate;
  renk: string; // hex color used on the calendar column header
  active: boolean;
  calismaSaatleri?: WeeklyWorkingHours;
}

export interface WeeklyWorkingHours {
  pazartesi?: DayWorkingHours;
  sali?: DayWorkingHours;
  carsamba?: DayWorkingHours;
  persembe?: DayWorkingHours;
  cuma?: DayWorkingHours;
  cumartesi?: DayWorkingHours;
  pazar?: DayWorkingHours;
}

export interface DayWorkingHours {
  start: string; // "09:00"
  end: string; // "18:00"
  off: boolean;
}

export type LeaveType = 'yillik' | 'rapor' | 'ucretsiz' | 'diger';

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  yillik: 'Yıllık İzin',
  rapor: 'Rapor',
  ucretsiz: 'Ücretsiz',
  diger: 'Diğer',
};

/** Leaves created before approval existed have no status and count as approved. */
export type LeaveStatus = 'beklemede' | 'onaylandi' | 'reddedildi';

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  beklemede: 'Onay Bekliyor',
  onaylandi: 'Onaylandı',
  reddedildi: 'Reddedildi',
};

export interface StaffLeave {
  staffId: string;
  type: LeaveType;
  status?: LeaveStatus;
  startDate: FirestoreDate;
  endDate: FirestoreDate;
  note?: string;
  createdAt: FirestoreDate;
  createdBy: string;
}

export type TaskStatus = 'acik' | 'devam' | 'tamamlandi';
export type TaskPriority = 'dusuk' | 'normal' | 'yuksek';

export interface StaffTask {
  baslik: string;
  aciklama?: string;
  staffId?: string;
  dueDate?: FirestoreDate;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: FirestoreDate;
  createdBy: string;
}
