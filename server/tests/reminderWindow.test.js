const test = require('node:test');
const assert = require('node:assert/strict');

const { isWithinWindow } = require('../utils/reminderWindow');

test('due from the slot time up to (not including) the grace limit', () => {
    assert.equal(isWithinWindow('08:00', '08:00', 60), true);
    assert.equal(isWithinWindow('08:59', '08:00', 60), true);
    assert.equal(isWithinWindow('09:00', '08:00', 60), false);
});

test('not due before the slot time', () => {
    assert.equal(isWithinWindow('07:59', '08:00', 60), false);
});

test('the 3pm-install case: a morning slot no longer fires in the afternoon', () => {
    assert.equal(isWithinWindow('15:00', '08:00', 60), false);
});

test('window wraps past midnight', () => {
    assert.equal(isWithinWindow('23:45', '23:30', 60), true);
    assert.equal(isWithinWindow('00:15', '23:30', 60), true);
    assert.equal(isWithinWindow('00:30', '23:30', 60), false);
    assert.equal(isWithinWindow('23:29', '23:30', 60), false);
});

test('invalid or missing times are never due', () => {
    assert.equal(isWithinWindow('08:00', undefined), false);
    assert.equal(isWithinWindow('08:00', '25:00'), false);
    assert.equal(isWithinWindow('08:00', 'abc'), false);
    assert.equal(isWithinWindow(undefined, '08:00'), false);
});

test('default grace is 60 minutes', () => {
    assert.equal(isWithinWindow('08:30', '08:00'), true);
    assert.equal(isWithinWindow('09:00', '08:00'), false);
});
