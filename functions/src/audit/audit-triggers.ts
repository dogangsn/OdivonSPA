import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue, tenantCollection } from '../lib/admin';

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
export const onAuditableWrite = onDocumentWritten(
  { document: 'tenants/{tenantId}/{collectionId}/{docId}', region: 'europe-west1' },
  async (event) => {
    const { tenantId, collectionId, docId } = event.params;
    if (EXCLUDED_COLLECTIONS.has(collectionId)) return;

    const before = event.data?.before?.exists ? event.data.before.data() ?? null : null;
    const after = event.data?.after?.exists ? event.data.after.data() ?? null : null;
    if (!before && !after) return;

    const action = !before ? 'create' : !after ? 'delete' : 'update';
    const actorUid = (after?.['updatedBy'] as string) ?? (after?.['createdBy'] as string) ?? (before?.['createdBy'] as string) ?? 'unknown';

    await tenantCollection(tenantId, 'auditLogs').add({
      entity: collectionId,
      action,
      entityId: docId,
      before,
      after,
      userId: actorUid,
      userEmail: '',
      createdAt: FieldValue.serverTimestamp(),
    });
  },
);
