const test = require('node:test');
const assert = require('node:assert/strict');

const { mergeDeviceRows } = require('../utils/wearableMerge');

test('two real devices on the same date (clean switch): sum, not max', () => {
  const rows = [
    { deviceType: 'whoop', steps: 7000 },
    { deviceType: 'garmin', steps: 5000 },
  ];
  assert.equal(mergeDeviceRows(rows, ['steps']).steps, 12000);
});

test('manual entry alongside a device, device is higher: max wins, not added together', () => {
  const rows = [
    { deviceType: 'whoop', steps: 7000 },
    { deviceType: 'manual', steps: 2000 },
  ];
  assert.equal(mergeDeviceRows(rows, ['steps']).steps, 7000);
});

test('manual entry alongside a device, manual is higher: max still wins', () => {
  const rows = [
    { deviceType: 'whoop', steps: 1000 },
    { deviceType: 'manual', steps: 6000 },
  ];
  assert.equal(mergeDeviceRows(rows, ['steps']).steps, 6000);
});

test('only manual entry, no device: manual value used', () => {
  const rows = [{ deviceType: 'manual', steps: 4000 }];
  assert.equal(mergeDeviceRows(rows, ['steps']).steps, 4000);
});

test('only one real device: that device value used', () => {
  const rows = [{ deviceType: 'google', steps: 8000 }];
  assert.equal(mergeDeviceRows(rows, ['steps']).steps, 8000);
});

test('no rows: zeros, not null/undefined', () => {
  const result = mergeDeviceRows([], ['steps', 'caloriesBurned']);
  assert.equal(result.steps, 0);
  assert.equal(result.caloriesBurned, 0);
});

test('three real devices (edge case): all summed', () => {
  const rows = [
    { deviceType: 'whoop', steps: 1000 },
    { deviceType: 'garmin', steps: 2000 },
    { deviceType: 'google', steps: 3000 },
  ];
  assert.equal(mergeDeviceRows(rows, ['steps']).steps, 6000);
});

test('multiple fields merged independently in one pass', () => {
  const rows = [
    { deviceType: 'whoop', steps: 7000, caloriesBurned: 100 },
    { deviceType: 'garmin', steps: 5000, caloriesBurned: 50 },
    { deviceType: 'manual', steps: 1000, caloriesBurned: 500 },
  ];
  const result = mergeDeviceRows(rows, ['steps', 'caloriesBurned']);
  assert.equal(result.steps, 12000); // whoop+garmin sum (12000) beats manual (1000)
  assert.equal(result.caloriesBurned, 500); // manual (500) beats whoop+garmin sum (150)
});
