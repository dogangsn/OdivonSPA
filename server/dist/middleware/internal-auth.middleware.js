"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.internalAuthMiddleware = internalAuthMiddleware;
const node_crypto_1 = require("node:crypto");
/** Guards /internal/* routes (system jobs with no Firebase caller) with a shared secret header. */
function internalAuthMiddleware(req, res, next) {
    const expected = process.env.INTERNAL_CRON_SECRET ?? process.env.CRON_SECRET;
    const provided = req.header('X-Cron-Secret');
    if (!expected || !provided || !timingSafeEqualStrings(provided, expected)) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }
    next();
}
function timingSafeEqualStrings(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(bufA, bufB);
}
//# sourceMappingURL=internal-auth.middleware.js.map