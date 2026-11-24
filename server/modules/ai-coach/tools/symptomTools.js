// SymptomLog reads/writes for the coach. Repo is injectable (Mongo / memory).
//
// Rules:
// - a symptom the user says they HAVE now opens an episode (or refreshes the
//   active one with the same name);
// - an episode closes ONLY when the user says it's gone ('resolved');
// - 'better' / 'same' / 'worse' are recorded and keep it active.

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Same symptom said slightly differently ("stomach pain" / "pain in stomach"
// stays separate on purpose: we only merge exact or contained names).
function findMatch(active, name) {
    const k = norm(name);
    return active.find((s) => s.key === k) || active.find((s) => s.key.includes(k) || k.includes(s.key));
}

const mongoSymptomRepo = {
    async listActive(userId) {
        const SymptomLog = require('../models/SymptomLog');
        return SymptomLog.find({ user: userId, status: 'active' }).sort({ startedAt: 1 }).lean();
    },
    async open(userId, name, at) {
        const SymptomLog = require('../models/SymptomLog');
        // Upsert on the partial unique index (one active per key): safe under races.
        return SymptomLog.findOneAndUpdate(
            { user: userId, key: norm(name), status: 'active' },
            { $setOnInsert: { user: userId, name: name.trim().slice(0, 80), key: norm(name), status: 'active', startedAt: at, lastStatus: 'new' }, $set: { lastMentionedAt: at } },
            { upsert: true, new: true, lean: true },
        );
    },
    async update(id, status, at) {
        const SymptomLog = require('../models/SymptomLog');
        const $set = { lastStatus: status, lastMentionedAt: at };
        if (status === 'resolved') Object.assign($set, { status: 'resolved', resolvedAt: at });
        await SymptomLog.updateOne({ _id: id }, { $set, $push: { updates: { at, status } } });
    },
    async markAsked(id, at) {
        const SymptomLog = require('../models/SymptomLog');
        await SymptomLog.updateOne({ _id: id }, { $set: { lastAskedAt: at }, $inc: { askCount: 1 } });
    },
};

function createMemorySymptomRepo() {
    const rows = [];
    let n = 0;
    return {
        rows,
        async listActive(userId) { return rows.filter((r) => r.user === String(userId) && r.status === 'active').map((r) => ({ ...r })); },
        async open(userId, name, at) {
            let r = rows.find((x) => x.user === String(userId) && x.key === norm(name) && x.status === 'active');
            if (!r) {
                r = { _id: `s${++n}`, user: String(userId), name: name.trim(), key: norm(name), status: 'active', startedAt: at, lastMentionedAt: at, lastAskedAt: null, askCount: 0, lastStatus: 'new', updates: [] };
                rows.push(r);
            } else r.lastMentionedAt = at;
            return { ...r };
        },
        async update(id, status, at) {
            const r = rows.find((x) => x._id === id);
            if (!r) return;
            r.lastStatus = status;
            r.lastMentionedAt = at;
            r.updates.push({ at, status });
            if (status === 'resolved') { r.status = 'resolved'; r.resolvedAt = at; }
        },
        async markAsked(id, at) {
            const r = rows.find((x) => x._id === id);
            if (r) { r.lastAskedAt = at; r.askCount++; }
        },
    };
}

function createSymptomTools({ repo = mongoSymptomRepo, logger = console } = {}) {
    // symptoms: names the user has now; updates: [{ name, status }] on known ones.
    async function record(userId, { symptoms = [], updates = [] }, now = new Date()) {
        const changed = [];
        try {
            let active = await repo.listActive(userId);
            for (const u of updates) {
                const match = findMatch(active, u.name);
                if (!match || !['better', 'same', 'worse', 'resolved'].includes(u.status)) continue;
                await repo.update(match._id, u.status, now);
                changed.push({ name: match.name, status: u.status });
                if (u.status === 'resolved') active = active.filter((s) => s._id !== match._id);
            }
            for (const name of symptoms) {
                if (!String(name || '').trim()) continue;
                // Already reported as an update this turn ("still burning"): don't reopen.
                if (updates.some((u) => findMatch([{ key: norm(u.name) }], name))) continue;
                const row = await repo.open(userId, name, now);
                if (!active.some((s) => String(s._id) === String(row._id))) changed.push({ name: row.name, status: 'new' });
            }
        } catch (err) {
            logger.error(`[AICoach] symptom log not updated: ${err.message}`);
        }
        return changed;
    }

    return { record, listActive: (userId) => repo.listActive(userId), markAsked: (id, at) => repo.markAsked(id, at) };
}

// Short replies about a symptom on record ("ab thik hai", "thoda kam", "abhi
// bhi"), read by code: the 24 Nov staging run showed the classifier calling
// "ab thik hai" small talk and resolving the symptom one turn late. Only
// when exactly one symptom is open (otherwise "which one?" is ambiguous) or
// the reply names it, and only for short replies.
const STATUS_RULES = [
    { status: 'worse', re: /\b(worse|badh (gaya|gayi|raha|rahi)|zyada (ho|hai)|aur kharab|bigad)\b/i },
    { status: 'same', re: /\b(same|waisa hi|waisi hi|abhi bhi|ab bhi|still|not better|theek nahi|thik nahi|nahi gaya|nahi gayi)\b/i },
    { status: 'better', re: /\b(better|thoda (kam|theek|thik|better)|kam (hai|hua|hui|ho gaya|ho gayi)|improv\w*|pehle se (achha|accha|behtar))\b/i },
    { status: 'resolved', re: /\b(th(i|ee)k (hai|ho gaya|ho gayi|hoon|hu|hun)|bilkul th(i|ee)k|fine now|i'?m fine|all good|gone|khatam|chala gaya|chali gayi|no more|resolved|ab nahi (hai|ho raha|ho rahi)|sahi (hai|ho gaya))\b/i },
];
const MAX_REPLY_WORDS = 10;

function parseSymptomReply(message, activeSymptoms = []) {
    const text = String(message || '').trim();
    if (!text || !activeSymptoms.length || text.split(/\s+/).length > MAX_REPLY_WORDS) return [];
    // First matching rule in order: "theek nahi" must be 'same' before 'theek' reads as resolved.
    const rule = STATUS_RULES.find((r) => r.re.test(text));
    if (!rule) return [];
    const named = activeSymptoms.filter((s) => text.toLowerCase().includes(s.key) || s.key.split(' ').some((w) => w.length > 3 && text.toLowerCase().includes(w)));
    const targets = named.length ? named : activeSymptoms.length === 1 ? activeSymptoms : [];
    return targets.map((s) => ({ name: s.name, status: rule.status }));
}

module.exports = { createSymptomTools, createMemorySymptomRepo, mongoSymptomRepo, findMatch, norm, parseSymptomReply };
