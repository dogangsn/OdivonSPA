"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.errorMiddleware = errorMiddleware;
exports.asyncHandler = asyncHandler;
const CODE_TO_STATUS = {
    unauthenticated: 401,
    'invalid-argument': 400,
    'failed-precondition': 400,
    'permission-denied': 403,
    'not-found': 404,
    internal: 500,
};
/** Thrown by route handlers — mirrors `HttpsError(code, message)` from the old Cloud Functions. */
class ApiError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
exports.ApiError = ApiError;
/** Registered last in app.ts. Preserves the exact Turkish message strings all client call sites already display. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function errorMiddleware(err, _req, res, _next) {
    if (err instanceof ApiError) {
        res.status(CODE_TO_STATUS[err.code]).json({ code: err.code, message: err.message });
        return;
    }
    console.error(err);
    res.status(500).json({ code: 'internal', message: 'Beklenmeyen bir hata oluştu.' });
}
/** Wraps an async Express handler so a thrown/rejected error reaches errorMiddleware via next(). */
function asyncHandler(fn) {
    return (req, res, next) => {
        fn(req, res).catch(next);
    };
}
//# sourceMappingURL=errors.js.map