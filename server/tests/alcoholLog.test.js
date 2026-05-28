/**
 * Unit tests for alcohol log utilities.
 * Run: node tests/alcoholLog.test.js
 */
const assert = require('assert');
const {
  sanitizeAlcoholLog,
  getAlcoholSummary,
  buildAlcoholContextForAI,
  getTodayKey
} = require('../utils/alcoholLog');

const today = getTodayKey();

const raw = {
  [today]: {
    count: 3,
    units: 3.5,
    resistedCount: 1,
    sessions: [
      { time: new Date().toISOString(), drinkType: 'wine', units: 1, context: 'social' },
      { time: new Date().toISOString(), drinkType: 'beer', units: 1, context: 'stress' },
      { time: new Date().toISOString(), drinkType: 'invalid', units: 99, context: 'invalid' }
    ]
  },
  'bad-key': { count: 5 },
  '2020-01-01': { count: 2, sessions: [] }
};

const sanitized = sanitizeAlcoholLog(raw);
assert.strictEqual(sanitized[today].count, 3);
assert.strictEqual(sanitized[today].sessions.length, 3);
assert.strictEqual(sanitized[today].sessions[2].drinkType, 'other');
assert.strictEqual(sanitized[today].sessions[2].units, 20);
assert.ok(!sanitized['bad-key']);

const summary = getAlcoholSummary(sanitized);
assert.strictEqual(summary.today, 3);
assert.strictEqual(summary.overLimit, true);

const ctx = buildAlcoholContextForAI(sanitized, { alcohol: true, alcoholFrequency: 'moderate' });
assert.ok(ctx.includes('moderate'));
assert.ok(ctx.includes('Today: 3'));

console.log('alcoholLog.test.js: all assertions passed');
