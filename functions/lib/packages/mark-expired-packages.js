"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markExpiredPackages = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
/** Daily sweep across every tenant: flips packages past their `bitisTarihi` from active to expired. */
exports.markExpiredPackages = (0, scheduler_1.onSchedule)({ schedule: 'every day 03:00', timeZone: 'Europe/Istanbul', region: 'europe-west1' }, async () => {
    const now = firestore_1.Timestamp.now();
    const snapshot = await admin_1.db
        .collectionGroup('customerPackages')
        .where('status', '==', 'active')
        .where('bitisTarihi', '<', now)
        .get();
    if (snapshot.empty)
        return;
    const batchSize = 400; // stay under the 500-write batch limit
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = admin_1.db.batch();
        for (const doc of snapshot.docs.slice(i, i + batchSize)) {
            batch.update(doc.ref, { status: 'expired' });
        }
        await batch.commit();
    }
});
//# sourceMappingURL=mark-expired-packages.js.map