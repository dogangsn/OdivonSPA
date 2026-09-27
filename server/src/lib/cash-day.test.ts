import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateIdInTz } from './cash-day';

test('dateIdInTz uses the tenant-local calendar day', () => {
  // 22:30 UTC on the 27th is already the 28th in Istanbul (UTC+3).
  const instant = new Date(Date.UTC(2026, 8, 27, 22, 30));
  assert.equal(dateIdInTz('Europe/Istanbul', instant), '2026-09-28');
  assert.equal(dateIdInTz('UTC', instant), '2026-09-27');
});
