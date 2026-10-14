/**
 * Recovery's sleep Regularity sub-score computed bedtime variance on a plain
 * number line (minutes-since-midnight), which breaks for anyone whose
 * bedtime straddles midnight: 23:55 and 00:05 are 10 minutes apart on a
 * clock but 1430 minutes apart as raw numbers, turning a consistent
 * near-midnight sleeper into a ~0 regularity score. circularStdDevMinutes
 * fixes this with standard circular statistics (same technique used for
 * compass bearings). These are the exact scenarios verified in chat before
 * implementing, now pinned as tests.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { circularStdDevMinutes } = require('../services/recoveryScoreService');

function toRegularityScore(sdMinutes) {
  return Math.round(Math.max(0, Math.min(100, 100 - (sdMinutes / 120) * 100)));
}

test('bedtimes straddling midnight: 23:50, 00:05, 23:55 are ~6 min apart, not ~673', () => {
  const sd = circularStdDevMinutes([23 * 60 + 50, 5, 23 * 60 + 55]);
  assert.ok(sd < 10, `expected a small SD, got ${sd}`);
  assert.ok(toRegularityScore(sd) >= 90, `expected a high regularity score, got ${toRegularityScore(sd)}`);
});

test('a genuinely irregular sleeper still scores low — the fix narrows the bug, not every SD', () => {
  const sd = circularStdDevMinutes([22 * 60, 90, 23 * 60 + 15]); // 22:00, 01:30, 23:15
  assert.ok(sd > 60, `expected a large SD for genuinely spread-out bedtimes, got ${sd}`);
  assert.ok(toRegularityScore(sd) < 50, `expected a low regularity score, got ${toRegularityScore(sd)}`);
});

test('bedtimes with no midnight wraparound: unaffected by the fix', () => {
  const sd = circularStdDevMinutes([22 * 60, 22 * 60 + 15, 21 * 60 + 50]); // 22:00, 22:15, 21:50
  assert.ok(Math.abs(sd - 10.4) < 0.5, `expected ~10.4 min SD, got ${sd}`);
});

test('two near-midnight bedtimes 10 minutes apart on the clock resolve to ~10, not ~1430', () => {
  // 23:55 and 00:05 — the exact pair from the chat walkthrough
  const sd = circularStdDevMinutes([23 * 60 + 55, 5, 23 * 60 + 55]); // third value repeats one to satisfy no particular constraint here, just checks pairwise distance behavior
  assert.ok(sd < 10, `expected a small SD, got ${sd}`);
});

test('identical bedtimes every night: zero variance', () => {
  const sd = circularStdDevMinutes([23 * 60, 23 * 60, 23 * 60]);
  assert.equal(Math.round(sd), 0);
});
