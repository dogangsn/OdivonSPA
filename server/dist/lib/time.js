"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantTimezone = getTenantTimezone;
exports.dayBoundsInTz = dayBoundsInTz;
exports.dateStampInTz = dateStampInTz;
const admin_1 = require("./admin");
const DEFAULT_TIMEZONE = 'Europe/Istanbul';
async function getTenantTimezone(tenantId) {
    const snap = await admin_1.db.doc(`tenants/${tenantId}`).get();
    return snap.data()?.['settings']?.['timezone'] ?? DEFAULT_TIMEZONE;
}
/** Offset (ms) of `timeZone` relative to UTC at the given instant. */
function tzOffsetMs(instant, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).formatToParts(instant);
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}
/** [start, end) instants of a local calendar day (`YYYY-MM-DD`) in `timeZone`. */
function dayBoundsInTz(dateStr, timeZone) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const localMidnightAsUtc = Date.UTC(y, m - 1, d);
    const startOffset = tzOffsetMs(new Date(localMidnightAsUtc), timeZone);
    const start = new Date(localMidnightAsUtc - startOffset);
    const nextMidnightAsUtc = Date.UTC(y, m - 1, d + 1);
    const end = new Date(nextMidnightAsUtc - tzOffsetMs(new Date(nextMidnightAsUtc), timeZone));
    return { start, end };
}
/** `YYYYMMDD` for "now" in `timeZone` (used in receipt numbers). */
function dateStampInTz(timeZone, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    return parts.replace(/-/g, '');
}
//# sourceMappingURL=time.js.map