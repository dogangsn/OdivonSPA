import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

export { createTenant } from './tenants/create-tenant';
export { inviteStaffUser, setStaffRole, deactivateStaffUser } from './tenants/staff-lifecycle';
export { checkoutSession } from './pos/checkout-session';
export { refundPayment } from './payments/refund-payment';
export { payoutCommissions } from './commissions/payout-commissions';
export { closeCashRegisterDay } from './cash/close-cash-register-day';
export { reopenCashRegisterDay } from './cash/reopen-cash-register-day';
export { markExpiredPackages } from './packages/mark-expired-packages';
export { onAuditableWrite } from './audit/audit-triggers';
