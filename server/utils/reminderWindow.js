// A reminder is "due" only inside [time, time + grace) on the user's own clock.
//
// This used to be `currentTime >= time`, i.e. "any time after the slot, until it
// is sent". That meant a user who opened the app at 3pm (or a server that was
// down until 3pm) still got the 08:00 breakfast reminder at 3pm, and a slot
// before 05:30 IST could fire twice because the dedupe "day" is the server's UTC
// day. A bounded window fixes both without any extra state.

const DEFAULT_GRACE_MIN = 60;

// "HH:MM" -> minutes since midnight, or null if the string is not a valid time.
const toMinutes = (hhmm) => {
    if (typeof hhmm !== 'string') return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
};

// True when `current` falls in [time, time + graceMin), wrapping past midnight
// (e.g. time 23:30, grace 60 => window is 23:30-00:30).
const isWithinWindow = (current, time, graceMin = DEFAULT_GRACE_MIN) => {
    const t = toMinutes(time);
    const c = toMinutes(current);
    if (t === null || c === null) return false;
    const elapsed = (c - t + 1440) % 1440; // minutes since the slot started
    return elapsed < graceMin;
};

module.exports = { isWithinWindow, toMinutes, DEFAULT_GRACE_MIN };
