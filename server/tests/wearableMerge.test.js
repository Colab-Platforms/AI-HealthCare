const test = require('node:test');
const assert = require('node:assert/strict');

const { mergeDeviceRows, maxAcrossRows, collapseToOnePerDay, filterPlausibleSleep } = require('../utils/wearableMerge');

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

test('maxAcrossRows: two real devices measuring the same sleep, never summed', () => {
  const rows = [
    { deviceType: 'whoop', totalSleepMinutes: 470 },
    { deviceType: 'google', totalSleepMinutes: 881 }, // a broken Health Connect sync
  ];
  assert.equal(maxAcrossRows(rows, ['totalSleepMinutes']).totalSleepMinutes, 881);
});

test('maxAcrossRows: manual entry is also just maxed, never added', () => {
  const rows = [
    { deviceType: 'whoop', totalSleepMinutes: 470 },
    { deviceType: 'manual', totalSleepMinutes: 420 },
  ];
  assert.equal(maxAcrossRows(rows, ['totalSleepMinutes']).totalSleepMinutes, 470);
});

test('maxAcrossRows: no rows gives zero', () => {
  assert.equal(maxAcrossRows([], ['totalSleepMinutes']).totalSleepMinutes, 0);
});

test('collapseToOnePerDay: picks the whole row with the most sleep, not a frankensteined mix', () => {
  const rows = [
    { date: new Date('2026-10-15T00:00:00.000Z'), deviceType: 'whoop', totalSleepMinutes: 482, bedTime: 'whoop-bedtime' },
    { date: new Date('2026-10-15T00:00:00.000Z'), deviceType: 'google', totalSleepMinutes: 458, bedTime: 'google-bedtime' },
  ];
  const result = collapseToOnePerDay(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].deviceType, 'whoop');
  assert.equal(result[0].bedTime, 'whoop-bedtime');
});

test('collapseToOnePerDay: different dates stay separate', () => {
  const rows = [
    { date: new Date('2026-10-14T00:00:00.000Z'), totalSleepMinutes: 400 },
    { date: new Date('2026-10-15T00:00:00.000Z'), totalSleepMinutes: 450 },
  ];
  assert.equal(collapseToOnePerDay(rows).length, 2);
});

test('filterPlausibleSleep: drops a broken device (~14.7h) when a real device has a sane reading', () => {
  const rows = [
    { deviceType: 'whoop', totalSleepMinutes: 470 },
    { deviceType: 'google', totalSleepMinutes: 881 }, // the real-world broken Health Connect case
  ];
  const result = filterPlausibleSleep(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].deviceType, 'whoop');
});

test('filterPlausibleSleep: caps instead of showing nothing when every reading is implausible', () => {
  const rows = [
    { deviceType: 'google', totalSleepMinutes: 881 },
    { deviceType: 'apple', totalSleepMinutes: 900 },
  ];
  const result = filterPlausibleSleep(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].totalSleepMinutes, 840);
});

test('filterPlausibleSleep: leaves normal readings untouched', () => {
  const rows = [
    { deviceType: 'whoop', totalSleepMinutes: 470 },
    { deviceType: 'manual', totalSleepMinutes: 420 },
  ];
  assert.deepEqual(filterPlausibleSleep(rows), rows);
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
