import { FirestoreDate } from './common.model';

export interface PackagePlan {
  ad: string;
  serviceId: string;
  seansAdedi: number;
  fiyat: number;
  gecerlilikGunu: number; // days valid after purchase
  active: boolean;
}

export type CustomerPackageStatus = 'active' | 'expired' | 'tamamlandi';

export interface CustomerPackage {
  customerId: string;
  packagePlanId: string;
  toplamSeans: number;
  kalanSeans: number;
  satisTarihi: FirestoreDate;
  bitisTarihi: FirestoreDate;
  status: CustomerPackageStatus;
  createdBy: string;
}
