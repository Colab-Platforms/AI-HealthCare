const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const { TIERS } = require('../services/gamificationService');

test('every gamification tier is allowed by the User schema (Health Legend was missing)', () => {
  const allowed = User.schema.path('gamification.currentTier').enumValues;
  for (const tier of TIERS) assert.ok(allowed.includes(tier.name), `${tier.name} missing from the User enum`);
});

test('a user past 1,000 points validates as Health Legend', async () => {
  const user = new User({ gamification: { totalPoints: 1005, currentTier: 'Health Legend' } });
  const err = user.validateSync(['gamification.currentTier']);
  assert.strictEqual(err, undefined);
});

test('gamification sends no notifications or pushes', () => {
  const source = fs.readFileSync(path.join(__dirname, '../services/gamificationService.js'), 'utf8');
  assert.ok(!/createNotification|sendToUser|notificationService|fcmService/.test(source));
});
