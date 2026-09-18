import { FirestoreDate, StaffRole } from './common.model';

export interface AuditLog {
  entity: string; // collection name, e.g. "customers"
  action: 'create' | 'update' | 'delete' | 'callable';
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  userId: string;
  userEmail: string;
  ip?: string; // only present when the write was routed through a callable Cloud Function
  createdAt: FirestoreDate;
}

export type InviteStatus = 'pending' | 'accepted' | 'revoked';

export interface Invite {
  email: string;
  role: StaffRole;
  token: string;
  status: InviteStatus;
  createdAt: FirestoreDate;
  createdBy: string;
}
