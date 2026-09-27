import { DocumentData, FieldValue, serverTimestamp } from '@angular/fire/firestore';

export type AuditAction = 'create' | 'update' | 'delete';

/** Deletes can't carry an `auditId` field, so their log entry has a deterministic id the rules can look up. */
export function deleteAuditId(collectionName: string, docId: string): string {
  return `del-${collectionName}-${docId}`;
}

/** Only the fields a patch touches, so an update log shows before → after for exactly what changed. */
export function pickKeys(data: DocumentData, keys: string[]): DocumentData {
  return Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]));
}

/** Drops Firestore sentinels (serverTimestamp, increment…) — they can't be stored inside a nested map. */
function plain(data: DocumentData | null): DocumentData | null {
  if (!data) return null;
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && !(v instanceof FieldValue)),
  );
}

export function auditEntry(
  entity: string,
  action: AuditAction,
  entityId: string,
  before: DocumentData | null,
  after: DocumentData | null,
  actor: { uid: string; email: string },
): DocumentData {
  return {
    entity,
    action,
    entityId,
    before: plain(before),
    after: plain(after),
    userId: actor.uid,
    userEmail: actor.email,
    createdAt: serverTimestamp(),
  };
}
