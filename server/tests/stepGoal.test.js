const test = require('node:test');
const assert = require('node:assert');
const { getStepGoal } = require('../utils/stepGoal');

test('no goal set: the age-based goal, never 10,000', () => {
  assert.deepStrictEqual(getStepGoal({ profile: { age: 33 } }), { goalSteps: 7500, isCustom: false });
  assert.strictEqual(getStepGoal({ profile: { age: 15 } }).goalSteps, 7000);
  assert.strictEqual(getStepGoal({ profile: { age: 70 } }).goalSteps, 8602);
});

test('a goal the user set always wins', () => {
  assert.deepStrictEqual(getStepGoal({ profile: { age: 33, lifestyle: { stepGoal: 6000 } } }), { goalSteps: 6000, isCustom: true });
});

test('an explicit age (e.g. from an active HealthGoal) is used for the default', () => {
  assert.strictEqual(getStepGoal({ profile: { age: 33 } }, 70).goalSteps, 8602);
});
