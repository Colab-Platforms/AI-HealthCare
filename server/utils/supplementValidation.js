// Validation + normalization for "add / edit supplement" requests. Pure — no DB.
// Returns { ok: true, value } with everything normalized and defaulted, or
// { ok: false, errors: [{ field, message }] }. Nothing from the request body
// reaches Mongo without passing through here.

const {
    FREQUENCIES, FORMS, UNITS, TIMES_PER_DAY, DEFAULT_TIMES, WEEKDAY_FREQUENCIES,
    REMINDER_OFFSET_MIN, computeEndDate,
} = require('./supplementSchedule');
const { isValidTimeZone, isValidDateString, localDateString, addDays, dayOfWeek } = require('./zonedTime');

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_NAME_LENGTH = 80;
const MAX_STRENGTH = 100000;
const MAX_QUANTITY = 20;
const MAX_FIXED_DAYS = 365;
const MAX_START_AHEAD_DAYS = 90;
const FALLBACK_TIMEZONE = 'Asia/Kolkata';

const UNIT_LOOKUP = new Map(UNITS.map((u) => [u.toLowerCase(), u]));

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const toNumber = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }
    return null;
};

// "Vitamin D", "vitamin d" and " VITAMIN  D " must group as one supplement when
// we later ask which typed (non-catalog) supplements users add most.
const normalizeName = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const defaultTimesFor = (frequency, catalogItem) => {
    const [min, max] = TIMES_PER_DAY[frequency];
    const fromCatalog = catalogItem?.defaultTimes;
    if (Array.isArray(fromCatalog) && fromCatalog.length >= min && fromCatalog.length <= max) return [...fromCatalog];
    return [...DEFAULT_TIMES[frequency]];
};

/**
 * @param {object} input  request body (or an existing supplement merged with edits)
 * @param {object} ctx    { catalogItem, fallbackTimezone, now, lockedStartDate }
 *                        lockedStartDate: on edit the start date is fixed and not re-checked.
 */
const validateSupplementInput = (input, ctx = {}) => {
    const { catalogItem = null, now = new Date(), lockedStartDate = null } = ctx;
    const src = isObject(input) ? input : {};
    const errors = [];
    const fail = (field, message) => errors.push({ field, message });

    // ---- timezone (everything else depends on "today" in the user's zone) ----
    const timezone = src.timezone ?? ctx.fallbackTimezone ?? FALLBACK_TIMEZONE;
    if (!isValidTimeZone(timezone)) {
        return { ok: false, errors: [{ field: 'timezone', message: 'Unknown timezone' }] };
    }
    const today = localDateString(now, timezone);

    // ---- identity ----
    let name;
    if (catalogItem) {
        name = catalogItem.name;
    } else if (typeof src.name !== 'string') {
        fail('name', 'Name is required');
    } else {
        name = src.name.trim().replace(/\s+/g, ' ');
        // eslint-disable-next-line no-control-regex
        if (!name || name.length > MAX_NAME_LENGTH || /[\u0000-\u001f]/.test(name)) {
            fail('name', `Name must be 1-${MAX_NAME_LENGTH} characters`);
            name = undefined;
        }
    }

    const form = src.form ?? catalogItem?.form;
    if (!FORMS.includes(form)) fail('form', `Form must be one of: ${FORMS.join(', ')}`);

    // ---- strength (optional) ----
    let strength = null;
    const rawStrength = src.strength === undefined ? catalogItem?.strength : src.strength;
    if (rawStrength !== undefined && rawStrength !== null) {
        const value = isObject(rawStrength) ? toNumber(rawStrength.value) : null;
        const unit = isObject(rawStrength) && typeof rawStrength.unit === 'string'
            ? UNIT_LOOKUP.get(rawStrength.unit.trim().toLowerCase())
            : undefined;
        if (value === null || value <= 0 || value > MAX_STRENGTH) fail('strength.value', 'Strength must be a positive number');
        else if (!unit) fail('strength.unit', `Unit must be one of: ${UNITS.join(', ')}`);
        else strength = { value, unit };
    }

    // ---- quantity per dose ----
    const quantityPerDose = toNumber(src.quantityPerDose ?? catalogItem?.quantityPerDose ?? 1);
    if (quantityPerDose === null || quantityPerDose <= 0 || quantityPerDose > MAX_QUANTITY || !Number.isInteger(quantityPerDose * 2)) {
        fail('quantityPerDose', `Quantity per dose must be a multiple of 0.5, up to ${MAX_QUANTITY}`);
    }

    // ---- duration (before schedule: a weekly default needs the start date) ----
    const rawDuration = src.duration === undefined ? { mode: 'ongoing' } : src.duration;
    let duration = null;
    if (!isObject(rawDuration) || !['fixed', 'ongoing'].includes(rawDuration.mode)) {
        fail('duration.mode', "Duration mode must be 'fixed' or 'ongoing'");
    } else {
        let days = null;
        if (rawDuration.mode === 'fixed') {
            days = toNumber(rawDuration.days);
            if (days === null || !Number.isInteger(days) || days < 1 || days > MAX_FIXED_DAYS) {
                fail('duration.days', `Fixed duration must be 1-${MAX_FIXED_DAYS} days`);
                days = null;
            }
        }
        const startDate = lockedStartDate || rawDuration.startDate || today;
        if (!isValidDateString(startDate)) {
            fail('duration.startDate', 'Start date must be YYYY-MM-DD');
        } else if (!lockedStartDate && (startDate < today || startDate > addDays(today, MAX_START_AHEAD_DAYS))) {
            fail('duration.startDate', `Start date must be between today and ${MAX_START_AHEAD_DAYS} days ahead`);
        } else if (rawDuration.mode === 'ongoing' || days !== null) {
            duration = {
                mode: rawDuration.mode,
                days,
                startDate,
                endDate: computeEndDate(startDate, { mode: rawDuration.mode, days }),
            };
        }
    }

    // ---- schedule ----
    const rawSchedule = src.schedule;
    let schedule = null;
    if (!isObject(rawSchedule)) {
        fail('schedule', 'Schedule is required');
    } else {
        const frequency = rawSchedule.frequency ?? catalogItem?.defaultFrequency;
        if (!FREQUENCIES.includes(frequency)) {
            fail('schedule.frequency', `Frequency must be one of: ${FREQUENCIES.join(', ')}`);
        } else {
            const [minTimes, maxTimes] = TIMES_PER_DAY[frequency];
            const times = rawSchedule.times === undefined ? defaultTimesFor(frequency, catalogItem) : rawSchedule.times;
            let timesOk = Array.isArray(times) && times.length >= minTimes && times.length <= maxTimes && times.every((t) => typeof t === 'string' && TIME_RE.test(t));
            if (timesOk && new Set(times).size !== times.length) timesOk = false;
            if (!timesOk) {
                fail('schedule.times', minTimes === maxTimes
                    ? `${frequency} needs exactly ${minTimes} distinct HH:mm time(s)`
                    : `Provide ${minTimes}-${maxTimes} distinct HH:mm times`);
            }

            let daysOfWeek = [];
            if (WEEKDAY_FREQUENCIES.has(frequency)) {
                const fallbackDay = duration ? [dayOfWeek(duration.startDate)] : undefined;
                const rawDays = rawSchedule.daysOfWeek === undefined && frequency === 'weekly' ? fallbackDay : rawSchedule.daysOfWeek;
                const daysOk = Array.isArray(rawDays)
                    && rawDays.length >= 1
                    && rawDays.length <= 7
                    && rawDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
                    && new Set(rawDays).size === rawDays.length
                    && (frequency !== 'weekly' || rawDays.length === 1);
                if (!daysOk) {
                    fail('schedule.daysOfWeek', frequency === 'weekly'
                        ? 'Weekly needs exactly one day (0=Sun ... 6=Sat)'
                        : 'Choose at least one day (0=Sun ... 6=Sat)');
                } else {
                    daysOfWeek = [...rawDays].sort((a, b) => a - b);
                }
            }
            if (timesOk) schedule = { frequency, daysOfWeek, times: [...times].sort() };
        }
    }

    // ---- reminder ----
    const reminderEnabled = src.reminderEnabled === undefined ? true : src.reminderEnabled;
    if (typeof reminderEnabled !== 'boolean') fail('reminderEnabled', 'reminderEnabled must be true or false');

    if (errors.length) return { ok: false, errors };

    return {
        ok: true,
        value: {
            name,
            normalizedName: normalizeName(name),
            form,
            strength,
            quantityPerDose,
            schedule,
            duration,
            reminder: { enabled: reminderEnabled, offsetMin: REMINDER_OFFSET_MIN },
            timezone,
        },
    };
};

module.exports = { validateSupplementInput, normalizeName, TIME_RE };
