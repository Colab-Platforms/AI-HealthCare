// Wall-clock <-> UTC conversion for IANA timezones, using only Intl.
//
// Supplement doses are scheduled on the user's own clock ("08:00 on 22 Oct in
// Asia/Kolkata"). The server runs UTC, so every dose is converted to an exact UTC
// instant ONCE when its row is created and stored that way; nothing downstream
// ever repeats timezone maths. A calendar day is carried as a "YYYY-MM-DD" string
// (never a Date) so it cannot shift when serialized or compared across zones.

const formatters = new Map(); // tz -> cached Intl.DateTimeFormat (construction is slow)

const getFormatter = (timeZone) => {
    let formatter = formatters.get(timeZone);
    if (!formatter) {
        // Throws RangeError for an unknown zone — callers rely on that in isValidTimeZone.
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        formatters.set(timeZone, formatter);
    }
    return formatter;
};

const isValidTimeZone = (timeZone) => {
    if (typeof timeZone !== 'string' || !timeZone) return false;
    try {
        getFormatter(timeZone);
        return true;
    } catch (e) {
        return false;
    }
};

const pad2 = (n) => String(n).padStart(2, '0');

// The wall-clock fields `ms` shows in `timeZone`.
const partsAt = (ms, timeZone) => {
    const out = {};
    for (const { type, value } of getFormatter(timeZone).formatToParts(new Date(ms))) {
        if (type !== 'literal') out[type] = Number(value);
    }
    out.hour %= 24; // some engines emit 24 for midnight even with h23
    return out;
};

// How far ahead of UTC the zone's wall clock is at instant `ms`, in ms.
const offsetMs = (ms, timeZone) => {
    const p = partsAt(ms, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - Math.floor(ms / 1000) * 1000;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateString = (s) => {
    if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === s;
};

// "YYYY-MM-DD" shown on the user's calendar at instant `date`.
const localDateString = (date, timeZone) => {
    const p = partsAt(date.getTime(), timeZone);
    return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
};

// "HH:mm" shown on the user's clock at instant `date`.
const localHHmm = (date, timeZone) => {
    const p = partsAt(date.getTime(), timeZone);
    return `${pad2(p.hour)}:${pad2(p.minute)}`;
};

// The UTC instant at which `timeZone`'s clock reads `dateStr` `hhmm`.
// Two-pass offset lookup so a slot on a DST-change day lands on the correct side
// of the transition (a time inside the spring-forward gap shifts forward).
const zonedTimeToUtc = (dateStr, hhmm, timeZone) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, min] = hhmm.split(':').map(Number);
    const guess = Date.UTC(y, m - 1, d, h, min);
    const first = offsetMs(guess, timeZone);
    let result = guess - first;
    const second = offsetMs(result, timeZone);
    if (second !== first) result = guess - second;
    return new Date(result);
};

// Calendar arithmetic on "YYYY-MM-DD" strings, done in UTC so it is DST-proof.
const addDays = (dateStr, n) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

// 0 = Sunday ... 6 = Saturday
const dayOfWeek = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

// Monday of the week containing dateStr.
const weekStartMonday = (dateStr) => addDays(dateStr, -((dayOfWeek(dateStr) + 6) % 7));

const maxDate = (a, b) => (a >= b ? a : b);

module.exports = {
    isValidTimeZone,
    isValidDateString,
    localDateString,
    localHHmm,
    zonedTimeToUtc,
    addDays,
    dayOfWeek,
    weekStartMonday,
    maxDate,
};
