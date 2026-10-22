const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isValidTimeZone, isValidDateString, localDateString, localHHmm, zonedTimeToUtc, addDays, dayOfWeek, weekStartMonday,
} = require('../utils/zonedTime');

test('IST wall time converts to the right UTC instant (+05:30, no DST)', () => {
    assert.equal(zonedTimeToUtc('2026-10-22', '08:00', 'Asia/Kolkata').toISOString(), '2026-10-22T02:30:00.000Z');
    assert.equal(zonedTimeToUtc('2026-10-22', '00:15', 'Asia/Kolkata').toISOString(), '2026-10-21T18:45:00.000Z');
});

test('DST: the same wall time maps to different UTC offsets either side of the change', () => {
    // New York springs forward on 2026-03-08 (EST -5 -> EDT -4)
    assert.equal(zonedTimeToUtc('2026-03-07', '08:00', 'America/New_York').toISOString(), '2026-03-07T13:00:00.000Z');
    assert.equal(zonedTimeToUtc('2026-03-08', '08:00', 'America/New_York').toISOString(), '2026-03-08T12:00:00.000Z');
});

test('localDateString crosses midnight in the user zone, not the server zone', () => {
    const instant = new Date('2026-10-21T20:00:00Z'); // 01:30 on the 22nd in IST
    assert.equal(localDateString(instant, 'Asia/Kolkata'), '2026-10-22');
    assert.equal(localDateString(instant, 'UTC'), '2026-10-21');
});

test('localHHmm and zonedTimeToUtc round-trip', () => {
    const instant = zonedTimeToUtc('2026-10-22', '21:30', 'Asia/Kolkata');
    assert.equal(localHHmm(instant, 'Asia/Kolkata'), '21:30');
});

test('addDays handles month/year boundaries and negatives', () => {
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('dayOfWeek and weekStartMonday', () => {
    assert.equal(dayOfWeek('2026-10-22'), 4); // Thursday
    assert.equal(weekStartMonday('2026-10-22'), '2026-10-19');
    assert.equal(weekStartMonday('2026-10-25'), '2026-10-19'); // Sunday belongs to the Monday before
});

test('validators reject junk', () => {
    assert.equal(isValidTimeZone('Asia/Kolkata'), true);
    assert.equal(isValidTimeZone('Mars/Olympus'), false);
    assert.equal(isValidTimeZone(''), false);
    assert.equal(isValidTimeZone(42), false);
    assert.equal(isValidDateString('2026-02-30'), false);
    assert.equal(isValidDateString('2026-10-22'), true);
    assert.equal(isValidDateString('22-10-2026'), false);
});
