"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.internalRouter = void 0;
const express_1 = require("express");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const errors_1 = require("../lib/errors");
exports.internalRouter = (0, express_1.Router)();
/** Daily sweep across every tenant: flips packages past their `bitisTarihi` from active to expired.
 *  Triggered by an external cron (GitHub Actions / cron-job.org) — see server/README or the deployment runbook. */
exports.internalRouter.post('/mark-expired-packages', (0, errors_1.asyncHandler)(async (_req, res) => {
    const now = firestore_1.Timestamp.now();
    const snapshot = await admin_1.db.collectionGroup('customerPackages').where('status', '==', 'active').where('bitisTarihi', '<', now).get();
    let updated = 0;
    if (!snapshot.empty) {
        const batchSize = 400; // stay under the 500-write batch limit
        for (let i = 0; i < snapshot.docs.length; i += batchSize) {
            const batch = admin_1.db.batch();
            for (const doc of snapshot.docs.slice(i, i + batchSize)) {
                batch.update(doc.ref, { status: 'expired' });
            }
            await batch.commit();
            updated += Math.min(batchSize, snapshot.docs.length - i);
        }
    }
    res.json({ updated });
}));
//# sourceMappingURL=internal.routes.js.map