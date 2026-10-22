const mongoose = require('mongoose');
const SupplementCatalog = require('../models/SupplementCatalog');
const UserSupplement = require('../models/UserSupplement');
const DoseLog = require('../models/DoseLog');
const NotificationPreference = require('../models/NotificationPreference');
const cache = require('../utils/cache');
const { validateSupplementInput, TIME_RE } = require('../utils/supplementValidation');
const {
    HORIZON_DAYS, generateDoseSlots, buildDoseDocs,
} = require('../utils/supplementSchedule');
const {
    isValidTimeZone, isValidDateString, localDateString, localHHmm, zonedTimeToUtc, addDays, weekStartMonday, maxDate,
} = require('../utils/zonedTime');

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const MAX_ACTIVE_SUPPLEMENTS = 30;
const MAX_LIST = 100;
const MAX_DOSE_RANGE_DAYS = 31;
const MAX_DOSE_ROWS = 500;
const MAX_CALENDAR_DAYS = 62;
const UPSERT_CHUNK = 500;
const CATALOG_CACHE_KEY = 'supplement:catalog:v1';
const CATALOG_CACHE_TTL_SEC = 10 * 60;
const FUTURE_SKEW_MS = 60 * 1000;
const DISCLAIMER = 'Based on what you’ve logged. Not medical advice.';

class SupplementError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const assertObjectId = (id, label = 'id') => {
    if (typeof id !== 'string' && !(id instanceof mongoose.Types.ObjectId)) throw new SupplementError(400, `Invalid ${label}`);
    if (!/^[a-f\d]{24}$/i.test(String(id))) throw new SupplementError(400, `Invalid ${label}`);
};

// ---------------------------------------------------------------------------
// timezone
// ---------------------------------------------------------------------------

// Saved preference zone (defaults to Asia/Kolkata at the schema level).
const getPreferenceTimezone = async (userId) => {
    const pref = await NotificationPreference.findOne({ userId }).select('timezone').lean();
    return pref?.timezone && isValidTimeZone(pref.timezone) ? pref.timezone : DEFAULT_TIMEZONE;
};

// Client-supplied zone wins when present, and must be valid.
const resolveTimezone = async (userId, requested) => {
    if (requested === undefined || requested === null || requested === '') return getPreferenceTimezone(userId);
    if (!isValidTimeZone(requested)) throw new SupplementError(400, 'Unknown timezone');
    return requested;
};

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

const toStrength = (s) => (s && s.value ? { value: s.value, unit: s.unit } : null);

const emptyStats = () => ({ taken: 0, missed: 0, notLogged: 0, scheduled: 0, consistency: null });

// consistency = taken / (taken + missed). Derived from rows every time, never
// stored: a stored counter would need hand-patching on every backfill
// (missed -> taken) and drift on the first bug.
const finalizeStats = (s) => {
    const scheduled = s.taken + s.missed + s.notLogged;
    return { ...s, scheduled, consistency: scheduled ? Math.round((s.taken / scheduled) * 100) : null };
};

const toSupplementDTO = (doc, stats = emptyStats()) => ({
    id: String(doc._id),
    catalogId: doc.catalogId ? String(doc.catalogId) : null,
    name: doc.name,
    form: doc.form,
    strength: toStrength(doc.strength),
    quantityPerDose: doc.quantityPerDose,
    schedule: doc.schedule,
    duration: doc.duration,
    reminderEnabled: doc.reminder?.enabled !== false,
    timezone: doc.timezone,
    status: doc.status,
    startedOn: doc.duration.startDate,
    createdAt: doc.createdAt,
    stats,
});

const toDoseDTO = (row, timezone) => ({
    id: String(row._id),
    supplementId: String(row.userSupplementId),
    name: row.snapshot.name,
    form: row.snapshot.form,
    strength: toStrength(row.snapshot.strength),
    quantityPerDose: row.snapshot.quantityPerDose,
    scheduledFor: row.scheduledFor,
    localDate: row.localDate,
    localTime: localHHmm(row.scheduledFor, timezone),
    status: row.status,
    takenAt: row.takenAt || null,
    missedSource: row.status === 'missed' ? row.missedSource || 'auto' : null,
});

const DOSE_FIELDS = 'userSupplementId scheduledFor localDate snapshot status takenAt missedSource';

// ---------------------------------------------------------------------------
// materialization: pre-creating the DoseLog rows
// ---------------------------------------------------------------------------

// Idempotent insert: upsert on the (supplement, scheduledFor) unique key. A retry,
// a double tap or two overlapping extender ticks can't create duplicates, and
// nothing throws on conflict. Identity fields are left out of $setOnInsert because
// the upsert already seeds them from the filter.
const upsertDoses = async (docs) => {
    for (let i = 0; i < docs.length; i += UPSERT_CHUNK) {
        const ops = docs.slice(i, i + UPSERT_CHUNK).map(({ userSupplementId, scheduledFor, ...rest }) => ({
            updateOne: { filter: { userSupplementId, scheduledFor }, update: { $setOnInsert: rest }, upsert: true },
        }));
        await DoseLog.bulkWrite(ops, { ordered: false });
    }
};

/**
 * Brings a supplement's DoseLog rows up to (user's local today + HORIZON_DAYS),
 * or to its end date, then records the new horizon. Safe to call repeatedly;
 * used on create, on edit, and by the extender tick.
 */
const materializeSupplement = async (sup, now = new Date()) => {
    const today = localDateString(now, sup.timezone);
    const horizon = addDays(today, HORIZON_DAYS);
    const endDate = sup.duration.endDate || null;
    const target = endDate && endDate < horizon ? endDate : horizon;
    const from = maxDate(addDays(sup.materializedThrough, 1), sup.duration.startDate);

    let created = 0;
    if (from <= target) {
        const slots = generateDoseSlots({
            schedule: sup.schedule, timezone: sup.timezone, fromDate: from, toDate: target, notBefore: now,
        });
        const docs = buildDoseDocs(sup, slots, now);
        await upsertDoses(docs);
        created = docs.length;
    }

    // Only moves the horizon after the rows are written: a crash in between leaves
    // the old horizon, and the extender simply redoes the (idempotent) work.
    const through = maxDate(sup.materializedThrough, target);
    await UserSupplement.updateOne(
        { _id: sup._id },
        { $set: { materializedThrough: through, materializationDone: Boolean(endDate) && through >= endDate } }
    );
    return created;
};

// ---------------------------------------------------------------------------
// catalog
// ---------------------------------------------------------------------------

const getCatalog = () => cache.getOrSet(CATALOG_CACHE_KEY, async () => {
    const items = await SupplementCatalog.find({ isActive: true })
        .sort({ sortOrder: 1, name: 1 })
        .select('-__v -createdAt -updatedAt')
        .lean();
    return items.map((item) => ({ ...item, id: String(item._id), _id: undefined }));
}, CATALOG_CACHE_TTL_SEC);

// ---------------------------------------------------------------------------
// stats
// ---------------------------------------------------------------------------

// Folds [{ _id: { st, ms }, n }] into a stats object.
const foldStatusCounts = (groups) => {
    const s = emptyStats();
    for (const { _id, n } of groups) {
        if (_id.st === 'taken') s.taken += n;
        else if (_id.st === 'missed') {
            if (_id.ms === 'user') s.missed += n;
            else s.notLogged += n;
        }
    }
    return finalizeStats(s);
};

const statsBySupplement = async (userId, supplementIds) => {
    const result = new Map();
    if (!supplementIds.length) return result;
    const groups = await DoseLog.aggregate([
        { $match: { userSupplementId: { $in: supplementIds.map(oid) }, status: { $in: ['taken', 'missed'] } } },
        { $group: { _id: { s: '$userSupplementId', st: '$status', ms: '$missedSource' }, n: { $sum: 1 } } },
    ]);
    const bySupp = new Map();
    for (const g of groups) {
        const key = String(g._id.s);
        if (!bySupp.has(key)) bySupp.set(key, []);
        bySupp.get(key).push({ _id: { st: g._id.st, ms: g._id.ms }, n: g.n });
    }
    for (const id of supplementIds) result.set(String(id), foldStatusCounts(bySupp.get(String(id)) || []));
    return result;
};

// ---------------------------------------------------------------------------
// supplements: create / list / detail / update / archive
// ---------------------------------------------------------------------------

const createSupplement = async (userId, body) => {
    const now = new Date();
    const fallbackTimezone = await getPreferenceTimezone(userId);

    let catalogItem = null;
    if (body && body.catalogId !== undefined && body.catalogId !== null) {
        assertObjectId(body.catalogId, 'catalogId');
        catalogItem = await SupplementCatalog.findOne({ _id: body.catalogId, isActive: true }).lean();
        if (!catalogItem) throw new SupplementError(404, 'Supplement not found in catalog');
    }

    const result = validateSupplementInput(body, { catalogItem, fallbackTimezone, now });
    if (!result.ok) throw new SupplementError(400, 'Invalid supplement details', result.errors);
    const value = result.value;

    const activeCount = await UserSupplement.countDocuments({ userId, status: 'active' });
    if (activeCount >= MAX_ACTIVE_SUPPLEMENTS) {
        throw new SupplementError(409, `You can track up to ${MAX_ACTIVE_SUPPLEMENTS} supplements at a time`);
    }

    let sup;
    try {
        sup = await UserSupplement.create({
            userId,
            catalogId: catalogItem ? catalogItem._id : null,
            ...value,
            strength: value.strength || undefined,
            materializedThrough: addDays(value.duration.startDate, -1),
        });
    } catch (err) {
        // Partial unique index on (userId, normalizedName) for active supplements.
        if (err && err.code === 11000) throw new SupplementError(409, `${value.name} is already in your routine`);
        throw err;
    }

    // The supplement exists now; if creating its doses fails the extender tick
    // repairs it from materializedThrough, so don't fail the user's request.
    try {
        await materializeSupplement(sup.toObject(), now);
    } catch (err) {
        console.error(`[Supplements] initial materialize failed for ${sup._id}:`, err.message);
    }

    const fresh = await UserSupplement.findById(sup._id).lean();
    return toSupplementDTO(fresh);
};

const listSupplements = async (userId, tab) => {
    const status = tab === 'past' ? { $in: ['completed', 'archived'] } : 'active';
    const docs = await UserSupplement.find({ userId, status })
        .sort({ updatedAt: -1 })
        .limit(MAX_LIST)
        .lean();
    const stats = await statsBySupplement(userId, docs.map((d) => d._id));
    return docs.map((d) => toSupplementDTO(d, stats.get(String(d._id))));
};

const getSupplement = async (userId, id, { calendarDays } = {}) => {
    assertObjectId(id, 'supplement id');
    const doc = await UserSupplement.findOne({ _id: id, userId }).lean();
    if (!doc) throw new SupplementError(404, 'Supplement not found');

    const days = Math.min(Math.max(parseInt(calendarDays, 10) || 35, 30), MAX_CALENDAR_DAYS);
    const today = localDateString(new Date(), doc.timezone);
    const from = addDays(today, -(days - 1));

    const [allTime, windowRows] = await Promise.all([
        statsBySupplement(userId, [doc._id]),
        DoseLog.aggregate([
            { $match: { userSupplementId: doc._id, localDate: { $gte: from, $lte: today }, status: { $in: ['taken', 'missed'] } } },
            { $group: { _id: { d: '$localDate', st: '$status', ms: '$missedSource' }, n: { $sum: 1 } } },
        ]),
    ]);

    const within = (fromDate) => foldStatusCounts(
        windowRows.filter((r) => r._id.d >= fromDate).map((r) => ({ _id: { st: r._id.st, ms: r._id.ms }, n: r.n }))
    );

    const calendarMap = new Map();
    for (const r of windowRows) {
        const day = calendarMap.get(r._id.d) || { date: r._id.d, taken: 0, missed: 0 };
        if (r._id.st === 'taken') day.taken += r.n; else day.missed += r.n;
        calendarMap.set(r._id.d, day);
    }

    return {
        ...toSupplementDTO(doc, allTime.get(String(doc._id))),
        history: {
            last7Days: within(addDays(today, -6)),
            last30Days: within(addDays(today, -29)),
        },
        calendar: [...calendarMap.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    };
};

// An existing supplement expressed as the request shape the validator takes, so
// an edit is "merge the changes in, validate the whole thing again".
const toInput = (doc) => ({
    name: doc.name,
    form: doc.form,
    strength: toStrength(doc.strength),
    quantityPerDose: doc.quantityPerDose,
    schedule: { frequency: doc.schedule.frequency, daysOfWeek: doc.schedule.daysOfWeek, times: doc.schedule.times },
    duration: { mode: doc.duration.mode, days: doc.duration.days, startDate: doc.duration.startDate },
    reminderEnabled: doc.reminder.enabled,
    timezone: doc.timezone,
});

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const updateSupplement = async (userId, id, body) => {
    assertObjectId(id, 'supplement id');
    if (!isObj(body)) throw new SupplementError(400, 'Invalid request body');
    const now = new Date();

    const existing = await UserSupplement.findOne({ _id: id, userId, status: 'active' }).lean();
    if (!existing) throw new SupplementError(404, 'Supplement not found');

    const base = toInput(existing);
    const merged = {
        ...base,
        ...body,
        schedule: { ...base.schedule, ...(isObj(body.schedule) ? body.schedule : {}) },
        duration: { ...base.duration, ...(isObj(body.duration) ? body.duration : {}) },
    };
    // Catalog supplements keep their catalog name; the rest of the form is editable.
    const catalogItem = existing.catalogId ? await SupplementCatalog.findById(existing.catalogId).lean() : null;

    const result = validateSupplementInput(merged, {
        catalogItem, fallbackTimezone: existing.timezone, now, lockedStartDate: existing.duration.startDate,
    });
    if (!result.ok) throw new SupplementError(400, 'Invalid supplement details', result.errors);
    const value = result.value;

    // Step 1 resets the horizon to "nothing materialized" BEFORE touching any dose
    // rows. If the process dies mid-edit, the extender tick sees the rolled-back
    // horizon and rebuilds the future rows — there is no half-edited state that
    // stays broken.
    const today = localDateString(now, value.timezone);
    const { strength, ...fields } = value;
    let updated;
    try {
        updated = await UserSupplement.findOneAndUpdate(
            { _id: id, userId, status: 'active' },
            {
                $set: { ...fields, materializedThrough: addDays(today, -1), materializationDone: false, ...(strength && { strength }) },
                ...(strength ? {} : { $unset: { strength: '' } }),
            },
            { new: true }
        ).lean();
    } catch (err) {
        if (err && err.code === 11000) throw new SupplementError(409, `${value.name} is already in your routine`);
        throw err;
    }
    if (!updated) throw new SupplementError(404, 'Supplement not found');

    // Future, untouched doses are regenerated from the new schedule. Taken / missed
    // rows and past pending ones are history and stay exactly as they were.
    await DoseLog.deleteMany({ userSupplementId: updated._id, status: 'pending', scheduledFor: { $gt: now } });
    await materializeSupplement(updated, now);

    // Real stats, not zeros: an edit doesn't touch history, so the response must
    // agree with what GET /supplements/:id shows.
    const [fresh, stats] = await Promise.all([
        UserSupplement.findById(updated._id).lean(),
        statsBySupplement(userId, [updated._id]),
    ]);
    return toSupplementDTO(fresh, stats.get(String(updated._id)));
};

// "Delete" stops the routine but keeps its history (it moves to My Stack > Past).
const archiveSupplement = async (userId, id) => {
    assertObjectId(id, 'supplement id');
    const now = new Date();
    const sup = await UserSupplement.findOneAndUpdate(
        { _id: id, userId, status: 'active' },
        { $set: { status: 'archived', archivedAt: now } },
        { new: true }
    ).lean();
    if (!sup) throw new SupplementError(404, 'Supplement not found');

    await DoseLog.deleteMany({ userSupplementId: sup._id, status: 'pending', scheduledFor: { $gt: now } });
    await DoseLog.updateMany({ userSupplementId: sup._id, reminderPending: true }, { $set: { reminderPending: false } });
    return { id: String(sup._id), status: 'archived' };
};

// ---------------------------------------------------------------------------
// doses: Today, lists, marking
// ---------------------------------------------------------------------------

const PERIODS = [
    { key: 'morning', label: 'Morning', until: '12:00' },
    { key: 'afternoon', label: 'Afternoon', until: '17:00' },
    { key: 'evening', label: 'Evening', until: '24:00' },
];

const periodOf = (hhmm) => PERIODS.find((p) => hhmm < p.until) || PERIODS[PERIODS.length - 1];

// The whole Today tab: three indexed reads on {userId, localDate}, run in parallel.
const getToday = async (userId, requestedTimezone) => {
    const timezone = await resolveTimezone(userId, requestedTimezone);
    const now = new Date();
    const today = localDateString(now, timezone);
    const weekStart = weekStartMonday(today);

    const [rows, upcomingRows, weekGroups] = await Promise.all([
        DoseLog.find({ userId, localDate: today }).sort({ scheduledFor: 1 }).select(DOSE_FIELDS).lean(),
        DoseLog.find({ userId, localDate: { $gt: today, $lte: addDays(today, HORIZON_DAYS) }, status: 'pending' })
            .sort({ scheduledFor: 1 }).limit(30).select(DOSE_FIELDS).lean(),
        DoseLog.aggregate([
            { $match: { userId: oid(userId), localDate: { $gte: weekStart, $lte: today }, scheduledFor: { $lte: now } } },
            { $group: { _id: '$status', n: { $sum: 1 } } },
        ]),
    ]);

    const sections = PERIODS.map((p) => ({ key: p.key, label: p.label, taken: 0, total: 0, doses: [] }));
    for (const row of rows) {
        const dto = toDoseDTO(row, timezone);
        const section = sections.find((s) => s.key === periodOf(dto.localTime).key);
        section.doses.push(dto);
        section.total += 1;
        if (row.status === 'taken') section.taken += 1;
    }

    // Next dose of each supplement that has nothing left today.
    const haveToday = new Set(rows.map((r) => String(r.userSupplementId)));
    const comingUp = [];
    for (const row of upcomingRows) {
        const key = String(row.userSupplementId);
        if (haveToday.has(key)) continue;
        haveToday.add(key);
        comingUp.push(toDoseDTO(row, timezone));
        if (comingUp.length >= 5) break;
    }

    // Deterministic copy, not an LLM call: free, instant, and can't invent a number.
    const week = { taken: 0, missed: 0, pending: 0 };
    for (const g of weekGroups) week[g._id] = g.n;
    const dueThisWeek = week.taken + week.missed + week.pending;
    const earlierPending = rows.filter((r) => r.status === 'pending' && r.scheduledFor <= now).length;
    let text = dueThisWeek
        ? `You’ve taken ${week.taken} of ${dueThisWeek} dose${dueThisWeek === 1 ? '' : 's'} this week (${Math.round((week.taken / dueThisWeek) * 100)}%).`
        : 'No doses have come due yet this week.';
    if (earlierPending) text += ` You still have ${earlierPending} dose${earlierPending === 1 ? '' : 's'} from earlier today to log.`;

    return {
        date: today,
        timezone,
        summary: { total: rows.length, taken: rows.filter((r) => r.status === 'taken').length },
        sections: sections.filter((s) => s.total > 0),
        comingUp,
        insight: { text, disclaimer: DISCLAIMER },
    };
};

// Past/future doses by date range — how a user finds yesterday's dose to backfill.
const listDoses = async (userId, { from, to, supplementId, timezone: requestedTimezone }) => {
    if (!isValidDateString(from) || !isValidDateString(to)) throw new SupplementError(400, 'from and to must be YYYY-MM-DD');
    if (to < from) throw new SupplementError(400, 'to must not be before from');
    if (to > addDays(from, MAX_DOSE_RANGE_DAYS - 1)) throw new SupplementError(400, `Range can be at most ${MAX_DOSE_RANGE_DAYS} days`);

    const filter = { userId, localDate: { $gte: from, $lte: to } };
    if (supplementId) {
        assertObjectId(supplementId, 'supplementId');
        filter.userSupplementId = supplementId;
    }
    const timezone = await resolveTimezone(userId, requestedTimezone);
    const rows = await DoseLog.find(filter).sort({ scheduledFor: 1 }).limit(MAX_DOSE_ROWS).select(DOSE_FIELDS).lean();
    return rows.map((r) => toDoseDTO(r, timezone));
};

// takenAt comes either as an ISO instant or as "HH:mm" on the dose's own day
// (what the time picker in the "Taken" sheet sends).
const resolveTakenAt = ({ takenAt, takenTime }, dose, timezone, now) => {
    let at = now;
    if (takenAt !== undefined && takenAt !== null) {
        at = new Date(takenAt);
        if (Number.isNaN(at.getTime())) throw new SupplementError(400, 'takenAt is not a valid date');
    } else if (takenTime !== undefined && takenTime !== null) {
        if (typeof takenTime !== 'string' || !TIME_RE.test(takenTime)) throw new SupplementError(400, 'takenTime must be HH:mm');
        at = zonedTimeToUtc(dose.localDate, takenTime, timezone);
    }
    if (at.getTime() > now.getTime() + FUTURE_SKEW_MS) throw new SupplementError(400, 'A dose can’t be logged as taken in the future');
    if (at.getTime() < dose.scheduledFor.getTime() - 24 * 60 * 60 * 1000) throw new SupplementError(400, 'Taken time is too far before the scheduled time');
    return at;
};

const setDoseStatus = async (userId, doseId, action, payload = {}) => {
    assertObjectId(doseId, 'dose id');
    const now = new Date();

    const dose = await DoseLog.findOne({ _id: doseId, userId }).select('userSupplementId scheduledFor localDate remindAt').lean();
    if (!dose) throw new SupplementError(404, 'Dose not found');

    const sup = await UserSupplement.findById(dose.userSupplementId).select('timezone').lean();
    const timezone = sup?.timezone || DEFAULT_TIMEZONE;
    if (dose.localDate > localDateString(now, timezone)) {
        throw new SupplementError(400, 'This dose is scheduled for a future day');
    }

    let update;
    if (action === 'take') {
        const takenAt = resolveTakenAt(payload, dose, timezone, now);
        update = { $set: { status: 'taken', takenAt, reminderPending: false }, $unset: { missedAt: '', missedSource: '' } };
    } else if (action === 'miss') {
        update = { $set: { status: 'missed', missedAt: now, missedSource: 'user', reminderPending: false }, $unset: { takenAt: '' } };
    } else { // 'clear' — "Remove log": back to pending
        // If it's already past the grace period the next sweep re-marks it missed,
        // which is the correct outcome. Re-arm the reminder only if still ahead.
        update = {
            $set: { status: 'pending', reminderPending: Boolean(dose.remindAt && dose.remindAt > now) },
            $unset: { takenAt: '', missedAt: '', missedSource: '' },
        };
    }

    const row = await DoseLog.findOneAndUpdate({ _id: doseId, userId }, update, { new: true }).select(DOSE_FIELDS).lean();
    return toDoseDTO(row, timezone);
};

// ---------------------------------------------------------------------------
// admin: which typed (non-catalog) supplements do users add most?
// ---------------------------------------------------------------------------

const getCustomSupplementStats = async (limit = 50) => {
    const cap = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    return UserSupplement.aggregate([
        { $match: { catalogId: null } },
        { $group: { _id: { n: '$normalizedName', u: '$userId' }, sample: { $first: '$name' } } },
        { $group: { _id: '$_id.n', users: { $sum: 1 }, sampleName: { $first: '$sample' } } },
        { $sort: { users: -1 } },
        { $limit: cap },
        { $project: { _id: 0, normalizedName: '$_id', sampleName: 1, users: 1 } },
    ]).option({ maxTimeMS: 30000 });
};

module.exports = {
    SupplementError,
    getCatalog,
    createSupplement,
    listSupplements,
    getSupplement,
    updateSupplement,
    archiveSupplement,
    getToday,
    listDoses,
    markTaken: (userId, doseId, payload) => setDoseStatus(userId, doseId, 'take', payload),
    markMissed: (userId, doseId) => setDoseStatus(userId, doseId, 'miss'),
    clearDoseLog: (userId, doseId) => setDoseStatus(userId, doseId, 'clear'),
    getCustomSupplementStats,
    // shared with the reminder service
    materializeSupplement,
    CATALOG_CACHE_KEY,
};
