"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAuditableWrite = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin_1 = require("../lib/admin");
/**
 * Collections excluded from this generic trigger because they're written exclusively by callables
 * that already log an IP-attributed audit entry themselves (see `lib/audit.ts` usages) — auditing
 * them again here would be redundant, and auditing `auditLogs` itself would loop forever.
 */
const EXCLUDED_COLLECTIONS = new Set([
    'auditLogs',
    'sessions',
    'cashRegisterDays',
    'commissionAccruals',
    'commissionPayouts',
    'invites',
    'counters',
]);
/**
 * Generic before/after audit log for every direct client write (customers, appointments, catalog,
 * staff, leaves, tasks, ...). Attribution comes from the document's own `createdBy`/`updatedBy`
 * field — unlike callable-routed writes, a Firestore trigger has no caller IP to record.
 */
exports.onAuditableWrite = (0, firestore_1.onDocumentWritten)({ document: 'tenants/{tenantId}/{collectionId}/{docId}', region: 'europe-west1' }, async (event) => {
    const { tenantId, collectionId, docId } = event.params;
    if (EXCLUDED_COLLECTIONS.has(collectionId))
        return;
    const before = event.data?.before?.exists ? event.data.before.data() ?? null : null;
    const after = event.data?.after?.exists ? event.data.after.data() ?? null : null;
    if (!before && !after)
        return;
    const action = !before ? 'create' : !after ? 'delete' : 'update';
    const actorUid = after?.['updatedBy'] ?? after?.['createdBy'] ?? before?.['createdBy'] ?? 'unknown';
    await (0, admin_1.tenantCollection)(tenantId, 'auditLogs').add({
        entity: collectionId,
        action,
        entityId: docId,
        before,
        after,
        userId: actorUid,
        userEmail: '',
        createdAt: admin_1.FieldValue.serverTimestamp(),
    });
});
//# sourceMappingURL=audit-triggers.js.map