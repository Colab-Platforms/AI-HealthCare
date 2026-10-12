/**
 * Regression test for the WHOOP steps/calories "1 day behind" bug: the
 * steps.created/calories.created webhook's daily-total sample is timestamped
 * at the cycle's start, which is literally that night's bedtime (not "now")
 * -- confirmed by matching it millisecond-for-millisecond against the
 * bedTime of the sleep.created event for the same cycle. Bucketing by the
 * raw UTC date of that timestamp (the old behavior) landed the day's steps
 * total one WHOOP "day" behind what the WHOOP app itself shows.
 *
 * These three cases are real production timestamps for the same user,
 * cross-checked against WHOOP's own app (screenshot) for the expected date.
 *
 * Run: node --test tests/wearableWhoopCycleDay.test.js
 */
const { test } = require('node:test');
const assert = require('assert');

const { dateOnlyWhoopCycleDay } = require('../controllers/wearableController');

test('dateOnlyWhoopCycleDay: evening IST bedtime (no UTC/IST day rollover) maps to the next day', () => {
  // 2026-10-09T17:41:41.700Z = 23:11 IST Oct 9 (still Oct 9 in both UTC and IST).
  // WHOOP's own app shows this cycle's steps total under Sat Oct 10.
  const result = dateOnlyWhoopCycleDay('2026-10-09T17:41:41.700Z');
  assert.strictEqual(result.toISOString(), '2026-10-10T00:00:00.000Z');
});

test('dateOnlyWhoopCycleDay: late-night bedtime that already crossed into the next IST day maps to that same day', () => {
  // 2026-10-10T20:25:21.920Z = 01:55 IST Oct 11 (already past midnight IST).
  // WHOOP's own app shows this cycle's steps total under Sun Oct 11.
  const result = dateOnlyWhoopCycleDay('2026-10-10T20:25:21.920Z');
  assert.strictEqual(result.toISOString(), '2026-10-11T00:00:00.000Z');
});

test('dateOnlyWhoopCycleDay: another evening-IST bedtime maps to the next day', () => {
  // 2026-10-11T17:48:02.800Z = 23:18 IST Oct 11 (still Oct 11).
  // WHOOP's own app shows this cycle's steps total under Mon Oct 12.
  const result = dateOnlyWhoopCycleDay('2026-10-11T17:48:02.800Z');
  assert.strictEqual(result.toISOString(), '2026-10-12T00:00:00.000Z');
});

test('dateOnlyWhoopCycleDay: a mid-morning IST timestamp (not a realistic bedtime, but checks the math) stays on the next calendar day only if +12h crosses midnight', () => {
  // 2026-10-05T04:00:00.000Z = 09:30 IST Oct 5. +12h = 21:30 IST Oct 5 -- no rollover.
  const result = dateOnlyWhoopCycleDay('2026-10-05T04:00:00.000Z');
  assert.strictEqual(result.toISOString(), '2026-10-05T00:00:00.000Z');
});
