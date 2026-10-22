const test = require('node:test');
const assert = require('node:assert/strict');

const { validateSupplementInput, normalizeName } = require('../utils/supplementValidation');

const NOW = new Date('2026-10-22T05:00:00Z'); // 10:30 IST, Thursday 22 Oct
const ctx = { now: NOW, fallbackTimezone: 'Asia/Kolkata' };

const MAGNESIUM = {
    name: 'Magnesium', form: 'capsule', strength: { value: 185, unit: 'mg' },
    quantityPerDose: 2, defaultFrequency: 'once', defaultTimes: ['21:30'],
};

test('catalog pick with only a schedule prefills everything else', () => {
    const r = validateSupplementInput({ schedule: {} }, { ...ctx, catalogItem: MAGNESIUM });
    assert.equal(r.ok, true);
    assert.equal(r.value.name, 'Magnesium');
    assert.equal(r.value.quantityPerDose, 2);
    assert.deepEqual(r.value.schedule.times, ['21:30']); // catalog's bedtime default
    assert.equal(r.value.duration.mode, 'ongoing');
    assert.equal(r.value.duration.startDate, '2026-10-22');
    assert.equal(r.value.reminder.enabled, true);
});

test('typed supplement: frequency defaults times, name is normalized for grouping', () => {
    const r = validateSupplementInput({
        name: '  Vitamin   D ', form: 'softgel', strength: { value: '1000', unit: 'iu' }, schedule: { frequency: 'twice' },
    }, ctx);
    assert.equal(r.ok, true);
    assert.equal(r.value.name, 'Vitamin D');
    assert.equal(r.value.normalizedName, 'vitamin d');
    assert.deepEqual(r.value.strength, { value: 1000, unit: 'IU' });
    assert.deepEqual(r.value.schedule.times, ['08:00', '20:00']);
});

test('normalizeName groups spelling variants', () => {
    assert.equal(normalizeName('VITAMIN D '), normalizeName('vitamin   d'));
});

test('typed supplement without form is rejected', () => {
    const r = validateSupplementInput({ name: 'Vitamin D', schedule: { frequency: 'once' } }, ctx);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.field === 'form'));
});

test('times must match the frequency and be valid HH:mm', () => {
    const base = { name: 'X', form: 'tablet' };
    assert.equal(validateSupplementInput({ ...base, schedule: { frequency: 'twice', times: ['08:00'] } }, ctx).ok, false);
    assert.equal(validateSupplementInput({ ...base, schedule: { frequency: 'once', times: ['8:00'] } }, ctx).ok, false);
    assert.equal(validateSupplementInput({ ...base, schedule: { frequency: 'once', times: ['24:00'] } }, ctx).ok, false);
    assert.equal(validateSupplementInput({ ...base, schedule: { frequency: 'twice', times: ['08:00', '08:00'] } }, ctx).ok, false);
});

test('custom needs weekdays; weekly defaults to the start date\'s weekday', () => {
    const base = { name: 'X', form: 'tablet' };
    assert.equal(validateSupplementInput({ ...base, schedule: { frequency: 'custom' } }, ctx).ok, false);
    const weekly = validateSupplementInput({ ...base, schedule: { frequency: 'weekly' } }, ctx);
    assert.equal(weekly.ok, true);
    assert.deepEqual(weekly.value.schedule.daysOfWeek, [4]); // Thursday
    const custom = validateSupplementInput({ ...base, schedule: { frequency: 'custom', daysOfWeek: [5, 1], times: ['09:00', '18:00'] } }, ctx);
    assert.deepEqual(custom.value.schedule.daysOfWeek, [1, 5]);
});

test('fixed duration needs days and computes the inclusive end date', () => {
    const base = { name: 'X', form: 'tablet', schedule: { frequency: 'once' } };
    assert.equal(validateSupplementInput({ ...base, duration: { mode: 'fixed' } }, ctx).ok, false);
    assert.equal(validateSupplementInput({ ...base, duration: { mode: 'fixed', days: 400 } }, ctx).ok, false);
    const r = validateSupplementInput({ ...base, duration: { mode: 'fixed', days: 30 } }, ctx);
    assert.equal(r.value.duration.endDate, '2026-11-20');
});

test('start date cannot be in the past or too far ahead (unless locked on edit)', () => {
    const base = { name: 'X', form: 'tablet', schedule: { frequency: 'once' } };
    assert.equal(validateSupplementInput({ ...base, duration: { mode: 'ongoing', startDate: '2026-10-21' } }, ctx).ok, false);
    assert.equal(validateSupplementInput({ ...base, duration: { mode: 'ongoing', startDate: '2027-03-01' } }, ctx).ok, false);
    assert.equal(validateSupplementInput({ ...base, duration: { mode: 'ongoing', startDate: '2026-10-25' } }, ctx).ok, true);
    // editing keeps the original (past) start date
    const edit = validateSupplementInput({ ...base, duration: { mode: 'ongoing' } }, { ...ctx, lockedStartDate: '2026-09-02' });
    assert.equal(edit.ok, true);
    assert.equal(edit.value.duration.startDate, '2026-09-02');
});

test('bad quantity, strength, unit, timezone and non-object body are rejected', () => {
    const base = { name: 'X', form: 'tablet', schedule: { frequency: 'once' } };
    assert.equal(validateSupplementInput({ ...base, quantityPerDose: 0 }, ctx).ok, false);
    assert.equal(validateSupplementInput({ ...base, quantityPerDose: 0.3 }, ctx).ok, false);
    assert.equal(validateSupplementInput({ ...base, strength: { value: -5, unit: 'mg' } }, ctx).ok, false);
    assert.equal(validateSupplementInput({ ...base, strength: { value: 5, unit: 'lbs' } }, ctx).ok, false);
    assert.equal(validateSupplementInput({ ...base, timezone: 'Mars/Olympus' }, ctx).ok, false);
    assert.equal(validateSupplementInput(null, ctx).ok, false);
    assert.equal(validateSupplementInput({ ...base, reminderEnabled: 'yes' }, ctx).ok, false);
});

test('a query-operator object is never accepted as a name', () => {
    const r = validateSupplementInput({ name: { $ne: null }, form: 'tablet', schedule: { frequency: 'once' } }, ctx);
    assert.equal(r.ok, false);
});
