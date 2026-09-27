import { Transaction } from 'firebase-admin/firestore';
import { tenantDoc } from './admin';
import { ApiError } from './errors';

/** `YYYY-MM-DD` of `now` in `timeZone` — the id of the cash register day money written now belongs to. */
export function dateIdInTz(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/**
 * Money written now lands in today's cash register day (by `createdAt`). Once that day is closed its
 * snapshot is final, so new sessions/payments/refunds must wait until an admin reopens it.
 * Pass the transaction so the check and the write are atomic.
 */
export async function assertCashDayOpen(tx: Transaction, tenantId: string, timeZone: string): Promise<void> {
  const dateId = dateIdInTz(timeZone);
  const snap = await tx.get(tenantDoc(tenantId, 'cashRegisterDays', dateId));
  if (snap.exists && snap.data()?.['status'] === 'closed') {
    throw new ApiError('failed-precondition', 'Bugünün kasası kapatılmış. Yeni işlem için önce yönetici kasayı yeniden açmalı.');
  }
}
