const test = require('node:test');
const assert = require('node:assert/strict');

const { buildReminderMessage, isInQuietHours } = require('../utils/supplementReminderMessage');

const row = (name, iso, qty = 1, form = 'capsule', supp = name) => ({
    _id: `dose-${name}`, userSupplementId: supp, scheduledFor: new Date(iso), snapshot: { name, form, quantityPerDose: qty },
});

test('single dose: names the supplement, quantity and local time', () => {
    const m = buildReminderMessage([row('Magnesium', '2026-10-22T16:00:00Z', 2)], 'Asia/Kolkata'); // 21:30 IST
    assert.equal(m.title, 'Time for Magnesium');
    assert.equal(m.message, 'Take 2 capsules at 9:30 PM');
    assert.deepEqual(m.doseIds, ['dose-Magnesium']);
});

test('several doses due together collapse into ONE notification', () => {
    const rows = [
        row('Berberine', '2026-10-22T02:30:00Z'),
        row('CoQ10', '2026-10-22T02:30:00Z'),
        row('Vitamin D', '2026-10-22T02:30:00Z'),
        row('Zinc', '2026-10-22T02:30:00Z'),
    ];
    const m = buildReminderMessage(rows, 'Asia/Kolkata');
    assert.equal(m.title, '4 supplements due soon');
    assert.match(m.message, /\+1 more at 8:00 AM$/);
    assert.equal(m.doseIds.length, 4);
    assert.equal(m.supplementIds.length, 4);
});

test('quiet hours, including a window that wraps past midnight', () => {
    const qh = { enabled: true, startTime: '22:00', endTime: '07:00' };
    assert.equal(isInQuietHours('23:30', qh), true);
    assert.equal(isInQuietHours('06:59', qh), true);
    assert.equal(isInQuietHours('07:00', qh), false);
    assert.equal(isInQuietHours('12:00', qh), false);
    assert.equal(isInQuietHours('12:00', { enabled: false, startTime: '22:00', endTime: '07:00' }), false);
    assert.equal(isInQuietHours('12:00', undefined), false);
});
