"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAuditableWrite = exports.saveAppointment = exports.sellPackage = exports.markExpiredPackages = exports.reopenCashRegisterDay = exports.closeCashRegisterDay = exports.payoutCommissions = exports.refundPayment = exports.checkoutSession = exports.deactivateStaffUser = exports.setStaffRole = exports.inviteStaffUser = exports.createTenant = void 0;
// Retired/reference-only: this Cloud Functions codebase can't be deployed on the Spark plan
// (Blaze is required for cloudbuild/artifactregistry). The live backend is `server/` (Express,
// hosted on Render). Kept here as the ground-truth reference the port was made from.
const v2_1 = require("firebase-functions/v2");
(0, v2_1.setGlobalOptions)({ region: 'europe-west1', maxInstances: 10 });
var create_tenant_1 = require("./tenants/create-tenant");
Object.defineProperty(exports, "createTenant", { enumerable: true, get: function () { return create_tenant_1.createTenant; } });
var staff_lifecycle_1 = require("./tenants/staff-lifecycle");
Object.defineProperty(exports, "inviteStaffUser", { enumerable: true, get: function () { return staff_lifecycle_1.inviteStaffUser; } });
Object.defineProperty(exports, "setStaffRole", { enumerable: true, get: function () { return staff_lifecycle_1.setStaffRole; } });
Object.defineProperty(exports, "deactivateStaffUser", { enumerable: true, get: function () { return staff_lifecycle_1.deactivateStaffUser; } });
var checkout_session_1 = require("./pos/checkout-session");
Object.defineProperty(exports, "checkoutSession", { enumerable: true, get: function () { return checkout_session_1.checkoutSession; } });
var refund_payment_1 = require("./payments/refund-payment");
Object.defineProperty(exports, "refundPayment", { enumerable: true, get: function () { return refund_payment_1.refundPayment; } });
var payout_commissions_1 = require("./commissions/payout-commissions");
Object.defineProperty(exports, "payoutCommissions", { enumerable: true, get: function () { return payout_commissions_1.payoutCommissions; } });
var close_cash_register_day_1 = require("./cash/close-cash-register-day");
Object.defineProperty(exports, "closeCashRegisterDay", { enumerable: true, get: function () { return close_cash_register_day_1.closeCashRegisterDay; } });
var reopen_cash_register_day_1 = require("./cash/reopen-cash-register-day");
Object.defineProperty(exports, "reopenCashRegisterDay", { enumerable: true, get: function () { return reopen_cash_register_day_1.reopenCashRegisterDay; } });
var mark_expired_packages_1 = require("./packages/mark-expired-packages");
Object.defineProperty(exports, "markExpiredPackages", { enumerable: true, get: function () { return mark_expired_packages_1.markExpiredPackages; } });
var sell_package_1 = require("./packages/sell-package");
Object.defineProperty(exports, "sellPackage", { enumerable: true, get: function () { return sell_package_1.sellPackage; } });
var save_appointment_1 = require("./appointments/save-appointment");
Object.defineProperty(exports, "saveAppointment", { enumerable: true, get: function () { return save_appointment_1.saveAppointment; } });
var audit_triggers_1 = require("./audit/audit-triggers");
Object.defineProperty(exports, "onAuditableWrite", { enumerable: true, get: function () { return audit_triggers_1.onAuditableWrite; } });
//# sourceMappingURL=index.js.map