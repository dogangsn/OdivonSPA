import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../lib/admin';

/** Daily sweep across every tenant: flips packages past their `bitisTarihi` from active to expired. */
export const markExpiredPackages = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'Europe/Istanbul', region: 'europe-west1' },
  async () => {
    const now = Timestamp.now();
    const snapshot = await db
      .collectionGroup('customerPackages')
      .where('status', '==', 'active')
      .where('bitisTarihi', '<', now)
      .get();

    if (snapshot.empty) return;

    const batchSize = 400; // stay under the 500-write batch limit
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      for (const doc of snapshot.docs.slice(i, i + batchSize)) {
        batch.update(doc.ref, { status: 'expired' });
      }
      await batch.commit();
    }
  },
);
