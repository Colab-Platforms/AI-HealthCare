// Builds the text of a supplement reminder. Pure — no DB, no FCM.
//
// One notification per user per tick, however many supplements are due: three
// supplements at 08:00 is one push ("3 supplements due soon"), not three. That is
// both nicer for the user and a 3x cut in FCM calls at the 08:00 peak.

const { formatQuantity } = require('./supplementSchedule');

const MAX_NAMES_LISTED = 3;

const timeFormatters = new Map();

// "8:00 AM" on the user's own clock.
const formatClock = (date, timeZone) => {
    let formatter = timeFormatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true });
        timeFormatters.set(timeZone, formatter);
    }
    return formatter.format(date);
};

// quiet hours are "HH:MM" strings on the user's clock; may wrap past midnight.
const isInQuietHours = (currentTime, quietHours) => {
    if (!quietHours?.enabled || !quietHours.startTime || !quietHours.endTime) return false;
    const { startTime, endTime } = quietHours;
    return startTime <= endTime
        ? currentTime >= startTime && currentTime < endTime
        : currentTime >= startTime || currentTime < endTime;
};

/**
 * @param rows      DoseLog rows due for ONE user: { _id, userSupplementId, scheduledFor, snapshot }
 * @param timeZone  that user's IANA zone
 */
const buildReminderMessage = (rows, timeZone) => {
    const sorted = [...rows].sort((a, b) => a.scheduledFor - b.scheduledFor);
    const time = formatClock(sorted[0].scheduledFor, timeZone);
    const doseIds = sorted.map((r) => r._id);
    const supplementIds = [...new Set(sorted.map((r) => String(r.userSupplementId)))];

    if (sorted.length === 1) {
        const { snapshot } = sorted[0];
        return {
            title: `Time for ${snapshot.name}`,
            message: `Take ${formatQuantity(snapshot.form, snapshot.quantityPerDose)} at ${time}`,
            doseIds,
            supplementIds,
        };
    }

    const names = [...new Set(sorted.map((r) => r.snapshot.name))];
    const listed = names.slice(0, MAX_NAMES_LISTED).join(', ');
    const extra = names.length > MAX_NAMES_LISTED ? ` +${names.length - MAX_NAMES_LISTED} more` : '';
    return {
        title: `${sorted.length} supplements due soon`,
        message: `${listed}${extra} at ${time}`,
        doseIds,
        supplementIds,
    };
};

module.exports = { buildReminderMessage, isInQuietHours, formatClock };
