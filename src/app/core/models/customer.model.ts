import { FirestoreDate } from './common.model';

export type CustomerGender = 'kadin' | 'erkek' | 'belirtilmedi';

export interface Customer {
  ad: string;
  telefon: string;
  email?: string;
  cinsiyet: CustomerGender;
  dogumTarihi?: FirestoreDate;
  kaynak?: string; // instagram, referans, google, walk-in...
  etiketler: string[];
  saglikNotu?: string;
  kvkkOnay: boolean;
  active: boolean; // soft delete
  createdAt: FirestoreDate;
  createdBy: string;
}
