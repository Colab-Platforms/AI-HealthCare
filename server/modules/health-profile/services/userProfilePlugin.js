// User model plugin: HealthProfile is the ONLY source of health facts (26 Nov).
//
// READ (always on): every User query that returns `profile` or
// `foodPreferences` (find, findOne, findOneAndUpdate, and populate, which runs
// a find) gets their health keys (age, gender, height, weight, allergies,
// conditions, medicines, lifestyle habits, diet, goals, diabetes, location,
// food likes / avoids ...) filled from HealthProfile, in the same shape as
// before (profileReadService.applyView). App settings (water / step / sleep
// goals, avatar, ...) stay as stored. One HealthProfile query per User query
// (batched for `find`, cached 10 s in-process).
//
// WRITE (HEALTH_PROFILE_ONLY=true): those keys are never written to User
// again: removed from every save / update before it reaches Mongo. Health
// facts are written only through ProfileWriteService. Turn on only after
// every user has a HealthProfile (scripts/migrateHealthProfile.js --apply),
// then remove the stored copies (scripts/migrateProfileMirror.js --apply).
//
// Not covered (no query middleware): aggregate() over users and raw
// `User.collection` reads. Those few places read HealthProfile themselves.
//
// Opt out for one query: .setOptions({ skipProfileOverlay: true }).

const { MIRROR_PATHS, ROOTS } = require('./profileReadService');

// Health keys of User.profile, relative to `profile` ("age", "medicalHistory.conditions", ...).
const HEALTH_PATHS = MIRROR_PATHS.filter((p) => p.startsWith('profile.')).map((p) => p.slice('profile.'.length));

const healthOnly = () => process.env.HEALTH_PROFILE_ONLY === 'true';

// false: the query returns no mirrored root. true: whole documents. An array:
// the full paths selected under the roots ('profile.age', 'foodPreferences'):
// only the health keys inside them are filled (a query that selected
// profile.avatar must not receive medicines).
function wantsProfile(query) {
    if (query.getOptions?.().skipProfileOverlay) return false;
    const p = query.projection?.();
    if (!p || typeof p !== 'object' || !Object.keys(p).length) return true;
    const keys = Object.keys(p).filter((k) => k !== '_id');
    const inclusive = keys.some((k) => p[k] === 1 || p[k] === true || (typeof p[k] === 'object' && p[k] !== null));
    if (!inclusive) return ROOTS.some((r) => !(p[r] === 0 || p[r] === false));
    const sel = keys.filter((k) => ROOTS.some((r) => k === r || k.startsWith(`${r}.`)));
    return sel.length ? sel : false;
}

async function overlay(result, only) {
    if (!result) return;
    const { overlayDocs } = require('./profileReadService');
    await overlayDocs(Array.isArray(result) ? result : [result], { only: Array.isArray(only) ? only : null });
}

// ---- write side -----------------------------------------------------------

const deletePath = (obj, rel) => {
    const keys = rel.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1 && cur; i++) cur = cur[keys[i]];
    if (cur && typeof cur === 'object') delete cur[keys[keys.length - 1]];
};

// Removes health keys from one root object (`profile` or `foodPreferences` as written).
function stripObject(value, root = 'profile') {
    if (!value || typeof value !== 'object') return;
    for (const full of MIRROR_PATHS) if (full.startsWith(`${root}.`)) deletePath(value, full.slice(root.length + 1));
}

// Removes health keys from one update body ({ 'profile.age': 30, profile: {...},
// 'profile.lifestyle': { smoker, stepGoal }, 'foodPreferences.state': ... }).
// A parent object ('profile.lifestyle') keeps its app settings and loses only
// the health keys.
function stripBody(body) {
    for (const key of Object.keys(body)) {
        if (ROOTS.includes(key)) { stripObject(body[key], key); continue; }
        const root = ROOTS.find((r) => key.startsWith(`${r}.`));
        if (!root) continue;
        if (MIRROR_PATHS.some((p) => key === p || key.startsWith(`${p}.`))) { delete body[key]; continue; }
        const children = MIRROR_PATHS.filter((p) => p.startsWith(`${key}.`)).map((p) => p.slice(key.length + 1));
        if (children.length && body[key] && typeof body[key] === 'object') {
            for (const c of children) deletePath(body[key], c);
        }
    }
}

function stripUpdate(update) {
    if (!update || typeof update !== 'object') return;
    for (const op of Object.keys(update)) {
        // $unset is how stored copies are REMOVED (migration): never blocked.
        if (!op.startsWith('$') || op === '$unset') continue;
        const body = update[op];
        if (!body || typeof body !== 'object') continue;
        stripBody(body);
        if (!Object.keys(body).length) delete update[op];
    }
    stripBody(update); // top-level keys of a replacement-style update ($ keys are skipped)
}

function userProfilePlugin(schema) {
    // No schema defaults on health keys ([] for allergies, 'no' for isDiabetic,
    // false for smoker, 'other' for region, 'India' for country ...). Mongoose
    // writes default-applied paths on the next save of a loaded document, and
    // those values are the ones the read hook filled from HealthProfile: every
    // login save would write the copy back. The values come from
    // HealthProfile; the mirror (flag off) writes them explicitly.
    for (const full of MIRROR_PATHS) {
        const st = schema.path(full);
        if (st && st.defaultValue !== undefined) st.default(undefined);
    }

    schema.post(['find', 'findOne', 'findOneAndUpdate'], async function (result) {
        const wants = wantsProfile(this);
        if (!wants) return;
        await overlay(result, wants);
    });

    // Only keys this save would actually WRITE (new document, or changed): a
    // document filled by the read hook and saved for another reason (login
    // updates lastLogin) keeps its in-memory health facts and writes none.
    schema.pre('save', function (next) {
        if (!healthOnly()) return next();
        for (const full of MIRROR_PATHS) {
            if ((this.isNew || this.isModified(full)) && this.get(full) !== undefined) this.set(full, undefined);
        }
        next();
    });

    schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'], function (next) {
        if (!healthOnly()) return next();
        stripUpdate(this.getUpdate());
        next();
    });
}

module.exports = { userProfilePlugin, HEALTH_PATHS, MIRROR_PATHS, wantsProfile, stripUpdate, stripObject, healthOnly };
