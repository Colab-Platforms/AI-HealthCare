// Pure schedule logic for the supplement tracker: which dose slots a schedule
// produces, and what a DoseLog row looks like. No DB access here so it is fully
// unit-testable.

const { zonedTimeToUtc, addDays, dayOfWeek } = require('./zonedTime');

const FREQUENCIES = ['once', 'twice', 'thrice', 'weekly', 'custom'];
const FORMS = ['tablet', 'capsule', 'softgel', 'syrup', 'drops', 'gummies', 'powder', 'liquid'];
const UNITS = ['mg', 'mcg', 'g', 'ml', 'IU'];

// How many dose times each frequency needs: [min, max].
const TIMES_PER_DAY = {
    once: [1, 1],
    twice: [2, 2],
    thrice: [3, 3],
    weekly: [1, 1],
    custom: [1, 6],
};

const DEFAULT_TIMES = {
    once: ['08:00'],
    twice: ['08:00', '20:00'],
    thrice: ['08:00', '14:00', '20:00'],
    weekly: ['08:00'],
    custom: ['08:00'],
};

// Only these frequencies are tied to specific weekdays.
const WEEKDAY_FREQUENCIES = new Set(['weekly', 'custom']);

const HORIZON_DAYS = 7;          // doses are pre-created this many days ahead
const REMINDER_OFFSET_MIN = 10;  // reminder goes out this long before the dose
const MISSED_AFTER_MIN = 180;    // a still-pending dose becomes "missed" after this

const UNIT_LABELS = {
    tablet: ['tablet', 'tablets'],
    capsule: ['capsule', 'capsules'],
    softgel: ['softgel', 'softgels'],
    gummies: ['gummy', 'gummies'],
    drops: ['drop', 'drops'],
    syrup: ['dose', 'doses'],
    liquid: ['dose', 'doses'],
    powder: ['scoop', 'scoops'],
};

// "2 capsules", "1 softgel"
const formatQuantity = (form, quantity) => {
    const labels = UNIT_LABELS[form] || ['dose', 'doses'];
    return `${quantity} ${quantity === 1 ? labels[0] : labels[1]}`;
};

const appliesOn = (schedule, dateStr) => {
    if (!WEEKDAY_FREQUENCIES.has(schedule.frequency)) return true;
    return schedule.daysOfWeek.includes(dayOfWeek(dateStr));
};

// Last calendar day of a fixed course, inclusive: 30 days from the 1st ends on the 30th.
const computeEndDate = (startDate, duration) =>
    duration.mode === 'fixed' ? addDays(startDate, duration.days - 1) : null;

/**
 * Dose slots for fromDate..toDate (inclusive, user-local calendar days).
 * `notBefore` drops slots at or before that instant — used so adding a routine
 * at 3pm doesn't instantly create an 8am dose that would count as "missed".
 */
const generateDoseSlots = ({ schedule, timezone, fromDate, toDate, notBefore = null }) => {
    const slots = [];
    for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
        if (!appliesOn(schedule, date)) continue;
        schedule.times.forEach((time, slot) => {
            const scheduledFor = zonedTimeToUtc(date, time, timezone);
            if (notBefore && scheduledFor <= notBefore) return;
            slots.push({ localDate: date, slot, scheduledFor });
        });
    }
    return slots;
};

/**
 * DoseLog documents for a set of slots. `snapshot` freezes the supplement's
 * details at creation, so editing the supplement later never rewrites what a
 * past dose looked like, and Today needs no join to render.
 * A reminder is armed only if it is still in the future — otherwise it would fire
 * immediately for a dose whose reminder time has already passed.
 */
const buildDoseDocs = (supplement, slots, now) => {
    const offsetMs = supplement.reminder.offsetMin * 60 * 1000;
    return slots.map(({ localDate, slot, scheduledFor }) => {
        const remindAt = supplement.reminder.enabled ? new Date(scheduledFor.getTime() - offsetMs) : null;
        return {
            userId: supplement.userId,
            userSupplementId: supplement._id,
            scheduledFor,
            localDate,
            slot,
            snapshot: {
                name: supplement.name,
                form: supplement.form,
                strength: supplement.strength?.value ? { value: supplement.strength.value, unit: supplement.strength.unit } : undefined,
                quantityPerDose: supplement.quantityPerDose,
            },
            status: 'pending',
            remindAt,
            reminderPending: Boolean(remindAt && remindAt > now),
            createdAt: now,
        };
    });
};

module.exports = {
    FREQUENCIES,
    FORMS,
    UNITS,
    TIMES_PER_DAY,
    DEFAULT_TIMES,
    WEEKDAY_FREQUENCIES,
    HORIZON_DAYS,
    REMINDER_OFFSET_MIN,
    MISSED_AFTER_MIN,
    formatQuantity,
    appliesOn,
    computeEndDate,
    generateDoseSlots,
    buildDoseDocs,
};
