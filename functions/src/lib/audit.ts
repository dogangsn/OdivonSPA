import { db, FieldValue } from './admin';
import { AuthedContext } from './context';

interface AuditLogInput {
  tenantId: string;
  entity: string;
  action: 'create' | 'update' | 'delete' | 'callable';
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  actor: Pick<AuthedContext, 'uid' | 'email' | 'ip'>;
}

/** Written by callables only — these carry a real client IP, unlike the generic Firestore-trigger audit log. */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await db.collection(`tenants/${input.tenantId}/auditLogs`).add({
    entity: input.entity,
    action: input.action,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    userId: input.actor.uid,
    userEmail: input.actor.email,
    ip: input.actor.ip,
    createdAt: FieldValue.serverTimestamp(),
  });
}
