import { FirestoreDate } from './common.model';

export interface Room {
  ad: string;
  kapasite: number;
  active: boolean;
}

export interface Service {
  ad: string;
  tur: string; // kategori: masaj, cilt bakımı, ...
  sureDk: number;
  fiyat: number;
  kategori: string;
  uygunStaffIds: string[];
  active: boolean;
}

export interface Product {
  sku: string;
  ad: string;
  fiyat: number;
  kritikStokSeviyesi: number;
  mevcutStok: number;
  active: boolean;
}

export type StockMovementType = 'giris' | 'fire' | 'sayim' | 'iade';

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  giris: 'Giriş',
  fire: 'Fire',
  sayim: 'Sayım',
  iade: 'İade',
};

export interface StockMovement {
  productId: string;
  type: StockMovementType;
  qty: number; // signed: giriş/iade positive, fire negative, sayım = delta to reach counted value
  note?: string;
  createdAt: FirestoreDate;
  createdBy: string;
}
