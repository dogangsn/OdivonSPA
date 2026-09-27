"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireTenantAuth = requireTenantAuth;
const https_1 = require("firebase-functions/v2/https");
/** Every callable in this app is tenant-scoped — this is the single place that enforces that. */
function requireTenantAuth(request, allowedRoles) {
    const auth = request.auth;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'Bu işlem için giriş yapmanız gerekiyor.');
    }
    const tenantId = auth.token['tenantId'];
    const role = auth.token['role'];
    if (!tenantId || !role) {
        throw new https_1.HttpsError('failed-precondition', 'Kullanıcının bir işletmeye (tenant) atanmış rolü yok.');
    }
    if (allowedRoles && !allowedRoles.includes(role)) {
        throw new https_1.HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
    }
    return {
        uid: auth.uid,
        email: auth.token['email'] ?? '',
        tenantId,
        role,
        ip: getClientIp(request),
    };
}
function getClientIp(request) {
    const forwarded = request.rawRequest?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return request.rawRequest?.ip ?? 'unknown';
}
//# sourceMappingURL=context.js.map