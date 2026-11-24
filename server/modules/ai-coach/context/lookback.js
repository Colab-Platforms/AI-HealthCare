// How far back the user is asking about, in days. Deterministic parse
// (English + Hinglish); the classifier's own value is merged by taking the
// larger, so neither can shrink the other. 0 = not specified (specialists
// use their normal ~30-day window). Capped at a year.

const MAX_DAYS = 365;
const LONG_RANGE_DAYS = 30; // above this, specialists add monthly trends

const UNIT_DAYS = { day: 1, din: 1, week: 7, hafta: 7, hafte: 7, month: 30, mahina: 30, mahine: 30, mahino: 30, year: 365, saal: 365, sal: 365 };
const WORD_NUM = { a: 1, an: 1, one: 1, ek: 1, two: 2, do: 2, three: 3, teen: 3, four: 4, char: 4, chaar: 4, five: 5, paanch: 5, panch: 5, six: 6, chhe: 6, che: 6, seven: 7, saat: 7, eight: 8, aath: 8, nine: 9, nau: 9, ten: 10, das: 10, twelve: 12, barah: 12 };

const N_UNITS = /\b(\d{1,3}|a|an|one|ek|two|do|three|teen|four|char|chaar|five|paanch|panch|six|chhe|che|seven|saat|eight|aath|nine|nau|ten|das|twelve|barah)\s*(days?|din|weeks?|hafte|hafta|months?|mahine|mahina|mahino|years?|saal|sal)\b/gi;
const FIXED = [
    [/\b(this|last|past|pichle|pichhle) (week|hafte)\b/i, 7],
    [/\b(this|last|past|pichle|pichhle) (month|mahine)\b/i, 30],
    [/\b(this|last|past|pichle|pichhle) (year|saal)\b/i, 365],
    [/\b(since (january|february|march|april|may|june|july|august|september|october|november|december))\b/i, null], // handled below
    [/\b(all time|ever since|from the start|shuru se)\b/i, 365],
];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function parseLookbackDays(message, now = new Date()) {
    const text = String(message || '');
    let days = 0;
    for (const m of text.matchAll(N_UNITS)) {
        const n = /^\d+$/.test(m[1]) ? Number(m[1]) : WORD_NUM[m[1].toLowerCase()];
        const unit = m[2].toLowerCase().replace(/s$/, '');
        const per = UNIT_DAYS[unit] ?? UNIT_DAYS[m[2].toLowerCase()];
        if (n && per) days = Math.max(days, n * per);
    }
    for (const [re, value] of FIXED) {
        if (value && re.test(text)) days = Math.max(days, value);
    }
    const since = /\bsince (january|february|march|april|may|june|july|august|september|october|november|december)\b/i.exec(text);
    if (since) {
        const month = MONTHS.indexOf(since[1].toLowerCase());
        let start = new Date(Date.UTC(now.getUTCFullYear(), month, 1));
        if (start > now) start = new Date(Date.UTC(now.getUTCFullYear() - 1, month, 1));
        days = Math.max(days, Math.ceil((now - start) / 86400000));
    }
    return Math.min(MAX_DAYS, days);
}

function mergeLookback(classifierDays, message, now) {
    const fromModel = Number.isInteger(classifierDays) && classifierDays > 0 ? classifierDays : 0;
    return Math.min(MAX_DAYS, Math.max(fromModel, parseLookbackDays(message, now)));
}

// { startDate, endDate } as YYYY-MM-DD (UTC), for the analytics services.
function windowFor(days, now = new Date()) {
    const end = new Date(now);
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - days);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

module.exports = { parseLookbackDays, mergeLookback, windowFor, LONG_RANGE_DAYS, MAX_DAYS };
