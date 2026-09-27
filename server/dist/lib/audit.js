"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAuditLog = writeAuditLog;
const admin_1 = require("./admin");
/** Written by route handlers only — these carry a real client IP. */
async function writeAuditLog(input) {
    await admin_1.db.collection(`tenants/${input.tenantId}/auditLogs`).add({
        entity: input.entity,
        action: input.action,
        entityId: input.entityId,
        before: input.before ?? null,
        after: input.after ?? null,
        userId: input.actor.uid,
        userEmail: input.actor.email,
        ip: input.actor.ip,
        createdAt: admin_1.FieldValue.serverTimestamp(),
    });
}
//# sourceMappingURL=audit.js.map