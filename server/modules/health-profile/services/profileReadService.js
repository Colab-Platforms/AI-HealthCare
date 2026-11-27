// Reading health facts: HealthProfile is the ONLY source (26 Nov).
//
// Most of the app (and the mobile / web clients) read health facts as
// `user.profile.age`, `.allergies`, `.medicalHistory.currentMedications`,
// `user.foodPreferences.state`, `.foodsToAvoid` ... Those keys used to be a
// mirror written on every profile change. Readers now get them built from
// HealthProfile instead, in the same legacy shape (profileMapper.mirrorValues),
// so nothing downstream has to change:
//
//   withProfile(user)        one user (lean object): profile + foodPreferences overlaid
//   withProfiles(users)      many users, one HealthProfile query
//   profileView(stored, hp)  the overlay of `profile` (pure)
//   userView(user, hp)       the overlay of every mirrored root (pure)
//
// App settings that live on User and are NOT health facts (profile.lifestyle
// waterGoalMl / stepGoal / sleepGoalHours / waterGlassSizeMl, profile.avatar,
// foodPreferences.lastUpdated, ...) are kept as stored.
//
// A user with no HealthProfile yet keeps the stored keys (a user the
// migration has not reached; created lazily on the first write).

const { mirrorValues, MIRRORED_SECTIONS, KEEP_STORED_PATHS } = require('./profileMapper');

// Every mirrored key as a full User path ('profile.age', 'foodPreferences.state', ...).
const MIRROR_PATHS = [...new Set(MIRRORED_SECTIONS.flatMap((s) => Object.keys(mirrorValues({}, s))))];
const ROOTS = [...new Set(MIRROR_PATHS.map((p) => p.split('.')[0]))]; // ['profile', 'foodPreferences']

function cloneDeep(v) {
    if (v === null || typeof v !== 'object') return v;
    if (v instanceof Date) return new Date(v.getTime());
    if (Array.isArray(v)) return v.map(cloneDeep);
    if (v._bsontype) return v; // ObjectId and other BSON values: immutable, keep as is
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = cloneDeep(val);
    return out;
}

function setPath(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] === null || typeof cur[keys[i]] !== 'object') {
            if (value === undefined) return; // nothing to unset below a missing parent
            cur[keys[i]] = {};
        }
        cur = cur[keys[i]];
    }
    const last = keys[keys.length - 1];
    if (value === undefined) delete cur[last];
    else cur[last] = cloneDeep(value);
}

// Is full path `p` ('profile.lifestyle.smoker') inside what a query selected
// ('profile', 'profile.lifestyle', 'profile.lifestyle.smoker')? null = everything.
const selected = (p, only) => !only || only.some((o) => p === o || p.startsWith(`${o}.`));
const rootSelected = (root, only) => !only || only.some((o) => o === root || o.startsWith(`${root}.`));

// In place on `target` (an object holding the roots: a lean user, a document's
// _doc, or { profile }): each selected root is replaced by a copy with the
// health keys from HealthProfile. `only`: full paths a query selected.
function applyView(target, healthProfile, only = null) {
    if (!healthProfile) return target;
    const roots = {};
    for (const root of ROOTS) {
        if (!rootSelected(root, only)) continue;
        roots[root] = cloneDeep(target[root] && typeof target[root] === 'object' ? target[root] : {});
    }
    for (const section of MIRRORED_SECTIONS) {
        for (const [path, value] of Object.entries(mirrorValues(healthProfile, section))) {
            const root = path.split('.')[0];
            if (!roots[root] || !selected(path, only)) continue;
            // Same rule as the mirror write (toLegacyPatch): null / '' / undefined = not set.
            const set = value !== undefined && value !== null && value !== '';
            // Keys moved on 26 Nov: not in HealthProfile yet = keep the stored value (backfill pending).
            if (!set && KEEP_STORED_PATHS.has(path)) continue;
            setPath(roots[root], path.slice(root.length + 1), set ? value : undefined);
        }
    }
    Object.assign(target, roots);
    return target;
}

// The legacy-shaped profile: stored app settings + health facts from HealthProfile.
// `only`: the profile sub-paths a query selected ('age', 'lifestyle'); other health keys are not added.
function profileView(storedProfile, healthProfile, only = null) {
    const t = { profile: storedProfile };
    applyView(t, healthProfile, only ? only.map((p) => `profile.${p}`) : ['profile']);
    return t.profile && typeof t.profile === 'object' ? t.profile : cloneDeep(storedProfile || {});
}

// A copy of a user (lean) with every mirrored root built from HealthProfile.
function userView(user, healthProfile, only = null) {
    if (!user) return user;
    return applyView({ ...user }, healthProfile, only);
}

const HP_FIELDS = 'user basic body conditions medications allergies surgeries familyHistory disabilities intolerances mentalHealth lifestyle diet fitness goals diabetes';

const healthOnly = () => process.env.HEALTH_PROFILE_ONLY === 'true';

// Short in-process cache of HealthProfile docs: a cron or a request that reads
// the same users several times (loops, populate + protect) hits Mongo once.
// Cleared for a user on every profile write in this process
// (profileWriteService afterCommit); another instance can serve a value up to
// TTL_MS old, the same trade-off as utils/userCache (30 s). `null` is cached
// too ("this user has no HealthProfile"), so a miss isn't re-queried.
const TTL_MS = 10 * 1000;
const MAX_ENTRIES = 5000;
const cache = new Map(); // userId -> { doc, at }
function cacheGet(id) {
    const hit = cache.get(id);
    if (!hit) return undefined;
    if (Date.now() - hit.at > TTL_MS) { cache.delete(id); return undefined; }
    return hit.doc;
}
function cacheSet(id, doc) {
    cache.delete(id);
    cache.set(id, { doc, at: Date.now() });
    while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}
function invalidateProfileCache(userId) {
    if (userId) cache.delete(String(userId));
}

// Once per process: warn loudly if the unique index on health_profiles.user is
// missing (production has autoIndex off): without it every read is a
// collection scan.
let indexChecked = false;
function checkIndexOnce(HealthProfile, logger) {
    if (indexChecked) return;
    indexChecked = true;
    HealthProfile.collection.indexes()
        .then((ix) => {
            if (!ix.some((i) => i.unique && JSON.stringify(i.key) === JSON.stringify({ user: 1 }))) {
                logger.error('[HealthProfile] MISSING unique index on health_profiles.user: every profile read scans the collection. Run: node scripts/syncIndexes.js --only=HealthProfile,ProfileHistory');
            }
        })
        .catch(() => {});
}

// No DB connection (unit tests with mocked User queries, a script before
// connect) and HEALTH_PROFILE_ONLY off: nothing to read, the stored copy is used.
// A failed read: with HEALTH_PROFILE_ONLY on it THROWS (the request fails)
// because the stored copy is gone and an empty profile would be read as "no
// allergies, no medicines"; with it off it is logged and the stored copy is used.
async function loadProfiles(userIds, { HealthProfile, logger = console, noCache = false } = {}) {
    const ids = [...new Set(userIds.filter(Boolean).map(String))];
    if (!ids.length) return new Map();
    const injected = Boolean(HealthProfile);
    if (!injected) {
        if (!healthOnly() && require('mongoose').connection.readyState !== 1) return new Map();
        HealthProfile = require('../models/HealthProfile');
        checkIndexOnce(HealthProfile, logger);
    }
    const useCache = !injected && !noCache;
    const out = new Map();
    const todo = [];
    for (const id of ids) {
        const hit = useCache ? cacheGet(id) : undefined;
        if (hit === undefined) todo.push(id);
        else if (hit) out.set(id, hit);
    }
    if (!todo.length) return out;
    try {
        const docs = todo.length === 1
            ? [await HealthProfile.findOne({ user: todo[0] }).select(HP_FIELDS).lean()].filter(Boolean)
            : await HealthProfile.find({ user: { $in: todo } }).select(HP_FIELDS).lean();
        const found = new Map(docs.map((d) => [String(d.user), d]));
        for (const id of todo) {
            const doc = found.get(id) || null;
            if (useCache) cacheSet(id, doc);
            if (doc) out.set(id, doc);
        }
        return out;
    } catch (err) {
        if (healthOnly()) throw err;
        logger.error(`[HealthProfile] profile read failed, stored profile used: ${err.message}`);
        return out;
    }
}

// One user's HealthProfile doc (lean) or null.
async function loadProfile(userId, deps) {
    return (await loadProfiles([userId], deps)).get(String(userId)) || null;
}

// Users already filled in by the User query hook (userProfilePlugin) carry this
// mark, so the helpers below don't read HealthProfile a second time.
const OVERLAID = Symbol.for('healthProfile.overlaid');
const isOverlaid = (u) => Boolean(u && u[OVERLAID]);
function mark(u) {
    try { Object.defineProperty(u, OVERLAID, { value: true, enumerable: false, configurable: true }); } catch { /* frozen */ }
}

// In place, for query results: lean objects or Mongoose documents. A document's
// raw `_doc` roots are replaced (not .set()), so nothing is marked modified and
// a later save() never writes these values back by accident.
async function overlayDocs(docs, deps) {
    const list = (docs || []).filter((d) => d && d._id && !isOverlaid(d));
    if (!list.length) return;
    if (!deps?.HealthProfile && !healthOnly() && require('mongoose').connection.readyState !== 1) return;
    const map = await loadProfiles(list.map((d) => d._id), deps);
    const only = deps?.only || null;
    for (const d of list) {
        const hp = map.get(String(d._id));
        if (hp) applyView(d.$__ && d._doc ? d._doc : d, hp, only);
        mark(d);
    }
}

// A copy of `user` (a lean object) whose health keys come from HealthProfile.
async function withProfile(user, deps) {
    if (!user || !user._id || isOverlaid(user)) return user;
    const map = await loadProfiles([user._id], deps);
    return userView(user, map.get(String(user._id)));
}

async function withProfiles(users, deps) {
    if (!Array.isArray(users) || !users.length) return users;
    const todo = users.filter((u) => u && u._id && !isOverlaid(u));
    if (!todo.length) return users;
    const map = await loadProfiles(todo.map((u) => u._id), deps);
    return users.map((u) => (u && u._id && !isOverlaid(u) ? userView(u, map.get(String(u._id))) : u));
}

// The legacy-shaped roots of a user object that is already loaded, lean or a
// Mongoose document (API responses: login, register, profile, admin detail).
// Always reads: a saved document has lost its health keys (HEALTH_PROFILE_ONLY).
async function viewOf(user, deps) {
    if (!user) return {};
    const plain = typeof user.toObject === 'function' ? user.toObject() : user;
    if (!user._id) return { profile: plain.profile, foodPreferences: plain.foodPreferences };
    const map = await loadProfiles([user._id], deps);
    const t = applyView({ profile: plain.profile, foodPreferences: plain.foodPreferences }, map.get(String(user._id)));
    return { profile: t.profile, foodPreferences: t.foodPreferences };
}

async function profileOf(user, deps) {
    return (await viewOf(user, deps)).profile;
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DIABETES = { name: /diabet/i, status: { $ne: 'resolved' } };

// Admin filters on health facts (old 'profile.age' / 'profile.gender' ...
// query paths) -> the matching user ids, from HealthProfile. null = no health
// filter given. `genderPrefix`: a search term matched at the start of the gender.
async function userIdsMatching(f = {}, { HealthProfile = require('../models/HealthProfile') } = {}) {
    const q = {};
    if (f.ageMin || f.ageMax) {
        q['basic.age'] = {};
        if (f.ageMin) q['basic.age'].$gte = parseInt(f.ageMin, 10);
        if (f.ageMax) q['basic.age'].$lte = parseInt(f.ageMax, 10);
    }
    if (f.gender) q['basic.gender'] = f.gender;
    if (f.genderPrefix) q['basic.gender'] = { $regex: `^${escapeRegex(f.genderPrefix)}`, $options: 'i' };
    if (f.genderExact) q['basic.gender'] = { $regex: `^${escapeRegex(f.genderExact)}$`, $options: 'i' };
    if (f.activityLevel) q['lifestyle.activityLevel'] = f.activityLevel;
    if (f.dietaryPreference) q['diet.preference'] = f.dietaryPreference;
    if (f.isDiabetic === 'yes' || f.isDiabetic === true) q['conditions.items'] = { $elemMatch: DIABETES };
    if (f.isDiabetic === 'no' || f.isDiabetic === false) q['conditions.items'] = { $not: { $elemMatch: DIABETES } };
    if (!Object.keys(q).length) return null;
    const docs = await HealthProfile.find(q).select('user').lean();
    return docs.map((d) => d.user);
}

// One user's legacy-shaped profile by id (services that only need the profile).
async function getProfile(userId, { User = require('../../../models/User'), ...deps } = {}) {
    const user = await User.findById(userId).select('profile').lean();
    if (!user) return null;
    return (await withProfile(user, deps)).profile;
}

module.exports = {
    profileView, userView, applyView, overlayDocs, withProfile, withProfiles, viewOf, profileOf, getProfile,
    loadProfiles, loadProfile, invalidateProfileCache, isOverlaid, userIdsMatching, MIRROR_PATHS, ROOTS,
};
