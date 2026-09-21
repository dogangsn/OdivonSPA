import { db } from './admin';

const DEFAULT_TIMEZONE = 'Europe/Istanbul';

export async function getTenantTimezone(tenantId: string): Promise<string> {
  const snap = await db.doc(`tenants/${tenantId}`).get();
  return (snap.data()?.['settings']?.['timezone'] as string | undefined) ?? DEFAULT_TIMEZONE;
}

/** Offset (ms) of `timeZone` relative to UTC at the given instant. */
function tzOffsetMs(instant: Date, timeZone: string): number {
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
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** [start, end) instants of a local calendar day (`YYYY-MM-DD`) in `timeZone`. */
export function dayBoundsInTz(dateStr: string, timeZone: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const localMidnightAsUtc = Date.UTC(y, m - 1, d);
  const startOffset = tzOffsetMs(new Date(localMidnightAsUtc), timeZone);
  const start = new Date(localMidnightAsUtc - startOffset);
  const nextMidnightAsUtc = Date.UTC(y, m - 1, d + 1);
  const end = new Date(nextMidnightAsUtc - tzOffsetMs(new Date(nextMidnightAsUtc), timeZone));
  return { start, end };
}

/** `YYYYMMDD` for "now" in `timeZone` (used in receipt numbers). */
export function dateStampInTz(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts.replace(/-/g, '');
}
