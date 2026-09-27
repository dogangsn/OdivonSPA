"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsMiddleware = void 0;
const cors_1 = __importDefault(require("cors"));
// Defaults cover local dev and the Firebase Hosting domains, so a forgotten env var can't lock out the live site.
const DEFAULT_ORIGINS = 'http://localhost:4200,http://localhost:4201,http://localhost:4210,https://odivonspa.web.app,https://odivonspa.firebaseapp.com';
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS).split(',').map((o) => o.trim());
exports.corsMiddleware = (0, cors_1.default)({
    origin(origin, callback) {
        // No Origin header (curl, server-to-server, the /internal cron caller) — allow.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: false,
});
//# sourceMappingURL=cors.middleware.js.map