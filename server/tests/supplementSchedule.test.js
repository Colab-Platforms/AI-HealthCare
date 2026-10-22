const test = require('node:test');
const assert = require('node:assert/strict');

const { generateDoseSlots, buildDoseDocs, computeEndDate, formatQuantity } = require('../utils/supplementSchedule');

const TZ = 'Asia/Kolkata';

test('twice a day over 3 days produces 6 slots at the user\'s local times', () => {
    const slots = generateDoseSlots({
        schedule: { frequency: 'twice', daysOfWeek: [], times: ['08:00', '20:00'] },
        timezone: TZ, fromDate: '2026-10-22', toDate: '2026-10-24',
    });
    assert.equal(slots.length, 6);
    assert.equal(slots[0].scheduledFor.toISOString(), '2026-10-22T02:30:00.000Z');
    assert.equal(slots[1].scheduledFor.toISOString(), '2026-10-22T14:30:00.000Z');
    assert.deepEqual(slots.map((s) => s.slot), [0, 1, 0, 1, 0, 1]);
});

test('custom schedule only produces slots on the chosen weekdays', () => {
    // 2026-10-19 is a Monday; choose Mon (1) and Thu (4)
    const slots = generateDoseSlots({
        schedule: { frequency: 'custom', daysOfWeek: [1, 4], times: ['09:00'] },
        timezone: TZ, fromDate: '2026-10-19', toDate: '2026-10-25',
    });
    assert.deepEqual(slots.map((s) => s.localDate), ['2026-10-19', '2026-10-22']);
});

test('notBefore drops slots already in the past (adding a routine at 3pm)', () => {
    const now = new Date('2026-10-22T09:30:00Z'); // 15:00 IST
    const slots = generateDoseSlots({
        schedule: { frequency: 'twice', daysOfWeek: [], times: ['08:00', '20:00'] },
        timezone: TZ, fromDate: '2026-10-22', toDate: '2026-10-22', notBefore: now,
    });
    assert.equal(slots.length, 1);
    assert.equal(slots[0].slot, 1); // only the 20:00 dose remains today
});

test('fixed course ends on its last inclusive day', () => {
    assert.equal(computeEndDate('2026-10-01', { mode: 'fixed', days: 30 }), '2026-10-30');
    assert.equal(computeEndDate('2026-10-01', { mode: 'ongoing', days: null }), null);
});

test('a dose row only arms its reminder if the reminder time is still ahead', () => {
    const sup = {
        _id: 'sup1', userId: 'u1', name: 'Vitamin D', form: 'softgel', quantityPerDose: 1,
        strength: { value: 1000, unit: 'IU' }, reminder: { enabled: true, offsetMin: 10 },
    };
    const now = new Date('2026-10-22T02:25:00Z');
    const slots = [
        { localDate: '2026-10-22', slot: 0, scheduledFor: new Date('2026-10-22T02:30:00Z') }, // reminder was 02:20 -> passed
        { localDate: '2026-10-22', slot: 1, scheduledFor: new Date('2026-10-22T14:30:00Z') },
    ];
    const docs = buildDoseDocs(sup, slots, now);
    assert.equal(docs[0].reminderPending, false);
    assert.equal(docs[1].reminderPending, true);
    assert.equal(docs[1].remindAt.toISOString(), '2026-10-22T14:20:00.000Z');
    assert.equal(docs[1].snapshot.name, 'Vitamin D');
});

test('reminders off => no remindAt and never armed', () => {
    const sup = { _id: 's', userId: 'u', name: 'X', form: 'tablet', quantityPerDose: 1, reminder: { enabled: false, offsetMin: 10 } };
    const [doc] = buildDoseDocs(sup, [{ localDate: '2026-10-23', slot: 0, scheduledFor: new Date('2026-10-23T02:30:00Z') }], new Date('2026-10-22T00:00:00Z'));
    assert.equal(doc.remindAt, null);
    assert.equal(doc.reminderPending, false);
});

test('formatQuantity pluralizes by form', () => {
    assert.equal(formatQuantity('capsule', 1), '1 capsule');
    assert.equal(formatQuantity('capsule', 2), '2 capsules');
    assert.equal(formatQuantity('gummies', 1), '1 gummy');
});
