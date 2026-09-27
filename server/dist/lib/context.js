"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireTenantAuth = requireTenantAuth;
exports.getClientIp = getClientIp;
const errors_1 = require("./errors");
/** Every route in this app is tenant-scoped — this is the single place that enforces that. */
function requireTenantAuth(req, allowedRoles) {
    const authInfo = req.auth;
    if (!authInfo) {
        throw new errors_1.ApiError('unauthenticated', 'Bu işlem için giriş yapmanız gerekiyor.');
    }
    const tenantId = authInfo.token['tenantId'];
    const role = authInfo.token['role'];
    if (!tenantId || !role) {
        throw new errors_1.ApiError('failed-precondition', 'Kullanıcının bir işletmeye (tenant) atanmış rolü yok.');
    }
    if (allowedRoles && !allowedRoles.includes(role)) {
        throw new errors_1.ApiError('permission-denied', 'Bu işlem için yetkiniz yok.');
    }
    return {
        uid: authInfo.uid,
        email: authInfo.token['email'] ?? '',
        tenantId,
        role,
        ip: getClientIp(req),
    };
}
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip ?? 'unknown';
}
//# sourceMappingURL=context.js.map