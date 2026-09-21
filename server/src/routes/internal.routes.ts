import { Router } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { asyncHandler } from '../lib/errors';

export const internalRouter = Router();

/** Daily sweep across every tenant: flips packages past their `bitisTarihi` from active to expired.
 *  Triggered by an external cron (GitHub Actions / cron-job.org) — see server/README or the deployment runbook. */
internalRouter.post(
  '/mark-expired-packages',
  asyncHandler(async (_req, res) => {
    const now = Timestamp.now();
    const snapshot = await db.collectionGroup('customerPackages').where('status', '==', 'active').where('bitisTarihi', '<', now).get();

    let updated = 0;
    if (!snapshot.empty) {
      const batchSize = 400; // stay under the 500-write batch limit
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        for (const doc of snapshot.docs.slice(i, i + batchSize)) {
          batch.update(doc.ref, { status: 'expired' });
        }
        await batch.commit();
        updated += Math.min(batchSize, snapshot.docs.length - i);
      }
    }

    res.json({ updated });
  }),
);
