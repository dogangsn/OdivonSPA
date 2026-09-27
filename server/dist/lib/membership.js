"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMembership = resolveMembership;
exports.setMembershipClaims = setMembershipClaims;
const admin_1 = require("./admin");
const STAFF_ROLES = ['admin', 'reception', 'therapist'];
function isStaffRole(value) {
    return typeof value === 'string' && STAFF_ROLES.includes(value);
}
function membershipFromClaims(token) {
    const tenantId = token['tenantId'];
    const role = token['role'];
    return typeof tenantId === 'string' && isStaffRole(role) ? { tenantId, role } : null;
}
/**
 * Resolves a tenant membership without trusting a client-supplied tenant id.  A recovery is
 * allowed only for verified e-mail addresses with exactly one active staff membership.
 */
async function resolveMembership(uid, token) {
    const claimed = membershipFromClaims(token);
    if (claimed)
        return { status: 'claimed', ...claimed };
    const email = typeof token.email === 'string' ? token.email.trim().toLowerCase() : '';
    if (!email || token.email_verified !== true)
        return { status: 'none' };
    const staffSnapshots = await Promise.all([
        admin_1.db.collectionGroup('staff').where('emailNormalized', '==', email).where('active', '==', true).get(),
        // Legacy records did not have emailNormalized. Firebase Auth e-mails are normally lowercase,
        // so this preserves recovery for those records while all new writes use the normalized field.
        admin_1.db.collectionGroup('staff').where('email', '==', email).where('active', '==', true).get(),
    ]);
    const candidates = new Map();
    for (const snapshot of staffSnapshots) {
        for (const staff of snapshot.docs) {
            const tenantId = staff.ref.parent.parent?.id;
            const role = staff.get('role');
            if (tenantId && isStaffRole(role))
                candidates.set(tenantId, { tenantId, role });
        }
    }
    const activeCandidates = [];
    for (const candidate of candidates.values()) {
        const tenant = await admin_1.db.doc(`tenants/${candidate.tenantId}`).get();
        if (tenant.exists && tenant.get('active') === true)
            activeCandidates.push(candidate);
    }
    if (activeCandidates.length === 0)
        return { status: 'none' };
    if (activeCandidates.length > 1)
        return { status: 'ambiguous' };
    const membership = activeCandidates[0];
    await setMembershipClaims(uid, membership);
    return { status: 'restored', ...membership };
}
/** Preserves unrelated custom claims while updating the two authorization claims we own. */
async function setMembershipClaims(uid, membership) {
    const user = await admin_1.auth.getUser(uid);
    await admin_1.auth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), ...membership });
}
//# sourceMappingURL=membership.js.map