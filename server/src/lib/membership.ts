import { auth, db } from './admin';
import { StaffRole } from './context';

const STAFF_ROLES: StaffRole[] = ['admin', 'reception', 'therapist'];

export type MembershipResolution =
  | { status: 'claimed' | 'restored'; tenantId: string; role: StaffRole }
  | { status: 'none' }
  | { status: 'ambiguous' };

interface StaffMembership {
  tenantId: string;
  role: StaffRole;
}

type MembershipToken = Record<string, unknown>;

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && STAFF_ROLES.includes(value as StaffRole);
}

function membershipFromClaims(token: MembershipToken): StaffMembership | null {
  const tenantId = token['tenantId'];
  const role = token['role'];
  return typeof tenantId === 'string' && isStaffRole(role) ? { tenantId, role } : null;
}

/**
 * Resolves a tenant membership without trusting a client-supplied tenant id.  A recovery is
 * allowed only for verified e-mail addresses with exactly one active staff membership.
 */
export async function resolveMembership(uid: string, token: MembershipToken): Promise<MembershipResolution> {
  const claimed = membershipFromClaims(token);
  if (claimed) return { status: 'claimed', ...claimed };

  const email = typeof token.email === 'string' ? token.email.trim().toLowerCase() : '';
  if (!email || token.email_verified !== true) return { status: 'none' };

  const staffSnapshots = await Promise.all([
    db.collectionGroup('staff').where('emailNormalized', '==', email).where('active', '==', true).get(),
    // Legacy records did not have emailNormalized. Firebase Auth e-mails are normally lowercase,
    // so this preserves recovery for those records while all new writes use the normalized field.
    db.collectionGroup('staff').where('email', '==', email).where('active', '==', true).get(),
  ]);

  const candidates = new Map<string, StaffMembership>();
  for (const snapshot of staffSnapshots) {
    for (const staff of snapshot.docs) {
      const tenantId = staff.ref.parent.parent?.id;
      const role = staff.get('role');
      if (tenantId && isStaffRole(role)) candidates.set(tenantId, { tenantId, role });
    }
  }

  const activeCandidates: StaffMembership[] = [];
  for (const candidate of candidates.values()) {
    const tenant = await db.doc(`tenants/${candidate.tenantId}`).get();
    if (tenant.exists && tenant.get('active') === true) activeCandidates.push(candidate);
  }

  if (activeCandidates.length === 0) return { status: 'none' };
  if (activeCandidates.length > 1) return { status: 'ambiguous' };

  const membership = activeCandidates[0];
  await setMembershipClaims(uid, membership);
  return { status: 'restored', ...membership };
}

/** Preserves unrelated custom claims while updating the two authorization claims we own. */
export async function setMembershipClaims(uid: string, membership: StaffMembership): Promise<void> {
  const user = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), ...membership });
}
