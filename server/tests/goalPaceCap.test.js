const test = require('node:test');
const assert = require('node:assert');
const HealthGoal = require('../models/HealthGoal');

const gain55to65 = { goalType: 'weight_gain', currentWeight: 55, targetWeight: 65 };
const weeksFromNow = (weeks) => HealthGoal.resolveTargetDate({ targetWeeks: weeks });

test('55 -> 65 kg over 48 or 480 weeks is within the gain cap (reported case)', () => {
  for (const weeks of [48, 480]) {
    const check = HealthGoal.checkRequestedRate({ ...gain55to65, targetDate: weeksFromNow(weeks) });
    assert.strictEqual(check.isUnsafe, false, `${weeks} weeks`);
    assert.strictEqual(check.timeframeReceived, true);
    assert.strictEqual(check.weeksUsed, weeks);
  }
});

test('no readable timeframe falls back to 12 weeks and says so', () => {
  const targetDate = HealthGoal.resolveTargetDate({ targetWeeks: '48 weeks' });
  const check = HealthGoal.checkRequestedRate({ ...gain55to65, targetDate });
  assert.strictEqual(check.isUnsafe, true);
  assert.strictEqual(check.timeframeReceived, false);
  assert.strictEqual(check.weeksUsed, 12);
});

test('KCAL_PER_KG_FAT is exported (the override pace check read it as undefined)', () => {
  assert.strictEqual(HealthGoal.KCAL_PER_KG_FAT, 7700);
});

// 70 kg man, TDEE 2400, BMR 1650: gain cap 0.35 kg/week = +385 kcal/day,
// loss cap 0.7 kg/week = -770 kcal/day, floor max(1500, 1815) = 1815.
const override = (value) => HealthGoal.checkCalorieOverride({
  value, tdee: 2400, bmr: 1650, currentWeight: 70, goalType: 'weight_gain', gender: 'male',
});

test('manual override: a huge surplus now trips the pace cap', () => {
  const check = override(5000);
  assert.ok(Number.isFinite(check.impliedWeeklyRate));
  assert.strictEqual(check.exceedsRateCap, true);
});

test('manual override: values inside the cap and above the floor pass', () => {
  for (const value of [2400, 2700, 1900]) {
    const check = override(value);
    assert.strictEqual(check.exceedsRateCap, false, `${value} kcal`);
    assert.strictEqual(check.belowFloor, false, `${value} kcal`);
  }
});

test('manual override: a deficit beyond the loss cap or below the floor is flagged', () => {
  const check = override(1600);
  assert.strictEqual(check.exceedsRateCap, true);
  assert.strictEqual(check.belowFloor, true);
});
