const HealthProfile = require('../models/HealthProfile');
const writeService = require('./profileWriteService');
const { mongoRepo, VersionConflictError } = require('./profileRepo');

// Bridge for the existing write points (signup, health goal, weight log, smart
// scale) that used to write health facts straight into User.profile. They now
// call this module, which sends the facts through ProfileWriteService (the
// only HealthProfile writer; it also keeps User.profile in sync as a mirror).
//
// Rules:
// - Kill switch: HEALTH_PROFILE_WRITES=false sends every call down the old
//   path (legacy User.profile write only). Default is on.
// - Values from these flows are not trusted. Anything the HealthProfile schema
//   would reject (NaN, 0 age, 900 kg) is dropped and logged, never written,
//   and never fails the caller's main operation.
// - If the user's OLD data can't be turned into a valid HealthProfile (bad
//   legacy value the migration hasn't fixed yet), the request still succeeds:
//   the legacy write is done alone and the problem is logged loudly.

const isEnabled = () => process.env.HEALTH_PROFILE_WRITES !== 'false';

// HealthProfile field -> legacy User path, for the fields these flows write.
const LEGACY_PATHS = {
    'basic.age': 'profile.age',
    'body.heightCm': 'profile.height',
    'body.weightKg': 'profile.weight',
    // goals.targetWeightKg: no legacy copy (User.nutritionGoal removed 26 Nov).
};

const positiveNumber = (v) => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
};

const isBlank = (v) => v === undefined || v === null || v === ''
    || (typeof v === 'number' && !Number.isFinite(v));

// Keeps only the values the schema accepts. Blank values are skipped silently
// (the caller simply has nothing to say about that field); invalid ones are
// reported in `dropped`.
function cleanSections(sections) {
    const clean = {};
    const dropped = [];
    for (const [section, data] of Object.entries(sections || {})) {
        for (const [key, value] of Object.entries(data || {})) {
            if (isBlank(value)) continue;
            const path = `${section}.${key}`;
            const err = new HealthProfile({ [section]: { [key]: value } }).validateSync([path]);
            if (err) {
                dropped.push(`${path}=${JSON.stringify(value)}`);
                continue;
            }
            (clean[section] ||= {})[key] = value;
        }
    }
    return { clean, dropped };
}

// Legacy $set for the cleaned fields, skipping any path the caller's own patch
// already sets (or a parent/child of it): Mongo rejects both in one $set.
function legacySet(clean, callerSet = {}) {
    const taken = Object.keys(callerSet);
    const clash = (p) => taken.some((t) => t === p || t.startsWith(`${p}.`) || p.startsWith(`${t}.`));
    const $set = {};
    for (const [section, data] of Object.entries(clean)) {
        for (const [key, value] of Object.entries(data)) {
            const legacyPath = LEGACY_PATHS[`${section}.${key}`];
            if (legacyPath && !clash(legacyPath)) $set[legacyPath] = value;
        }
    }
    return $set;
}

function withLegacy(userPatch, clean) {
    const patch = { ...(userPatch || {}) };
    const $set = { ...(patch.$set || {}), ...legacySet(clean, patch.$set) };
    if (Object.keys($set).length) patch.$set = $set;
    return patch;
}

function createProfileSync({
    service = writeService,
    repo = mongoRepo,
    invalidate = writeService.invalidateProfileCaches,
    enabled = isEnabled,
    logger = console,
} = {}) {
    const { ProfileInputError } = writeService;

    // Signup: User doc already holds the onboarding profile. Best effort: a
    // failure here never fails signup, because the first later write builds
    // the profile from the same legacy data anyway (lazy creation).
    async function onSignup(userId, legacyUser) {
        if (!enabled()) return false;
        try {
            await service.createFromOnboarding(userId, legacyUser, { source: 'manual' });
            return true;
        } catch (err) {
            // Already exists (a parallel first write created it): nothing lost.
            if (err.status !== 409) {
                logger.error(`[HealthProfile] signup create failed for user ${userId}: ${err.message}`);
            }
            return false;
        }
    }

    // One transaction: the caller's own User update (non-profile fields such
    // as nutritionGoal or healthMetrics.bmi) + the profile facts through the
    // service (+ mirror + history). Caches cleared after commit.
    async function writeWithUser(userId, sections, userPatch, { source }) {
        const { clean, dropped } = cleanSections(sections);
        if (dropped.length) logger.warn(`[HealthProfile] user ${userId}: dropped invalid ${dropped.join(', ')}`);
        const hasProfile = Object.keys(clean).length > 0;

        if (!enabled()) {
            await repo.withTransaction((session) => repo.patchUser(userId, withLegacy(userPatch, clean), session));
            await invalidate(userId);
            return { synced: false };
        }

        const run = () => repo.withTransaction(async (session) => {
            await repo.patchUser(userId, userPatch || {}, session);
            if (hasProfile) await service.updateSections(userId, clean, { source, session });
        });

        try {
            try {
                await run();
            } catch (err) {
                // Two first-ever writes racing to create the profile: the loser
                // gets a conflict. Retry once; by then the profile exists.
                if (!(err instanceof VersionConflictError)) throw err;
                await run();
            }
        } catch (err) {
            if (!(err instanceof ProfileInputError)) throw err;
            logger.error(`[HealthProfile] user ${userId}: profile not synced, legacy write only (${err.message}). Fix with the migration script.`);
            await repo.withTransaction((session) => repo.patchUser(userId, withLegacy(userPatch, clean), session));
            await invalidate(userId);
            return { synced: false };
        }
        await invalidate(userId);
        return { synced: hasProfile };
    }

    // Smart scale / device weight. Runs inside the caller's session when given
    // (wearable sync transaction); the caller then clears caches after ITS
    // commit (see invalidate). A bad reading is skipped, never fails the sync.
    async function setDeviceWeight(userId, weightKg, { session } = {}) {
        // Coerced so "72.5" from a device is stored and compared as 72.5; 0 or
        // negative counts as invalid.
        const n = positiveNumber(weightKg);
        const { clean, dropped } = n === undefined
            ? { clean: {}, dropped: isBlank(weightKg) ? [] : [`body.weightKg=${JSON.stringify(weightKg)}`] }
            : cleanSections({ body: { weightKg: n } });
        if (dropped.length || !clean.body) {
            if (dropped.length) logger.warn(`[HealthProfile] user ${userId}: skipped device weight ${dropped.join(', ')}`);
            return { synced: false };
        }
        const legacyWrite = () => repo.withTransaction((s) => repo.patchUser(userId, withLegacy({}, clean), s), session);

        if (!enabled()) {
            await legacyWrite();
            return { synced: false };
        }
        try {
            await service.updateSections(userId, clean, { source: 'device', session });
            return { synced: true };
        } catch (err) {
            // Thrown before any DB write, so the caller's transaction is still usable.
            if (!(err instanceof ProfileInputError)) throw err;
            logger.error(`[HealthProfile] user ${userId}: device weight not synced, legacy write only (${err.message}).`);
            await legacyWrite();
            return { synced: false };
        }
    }

    // Old profile edit API (authController.updateProfile) has already saved
    // User.profile; bring the change into HealthProfile. Never throws: the
    // user's save succeeded, and the next sync (any later edit) self-heals a
    // missed one. The caller keeps its own BMI / nutrition / diet-plan logic.
    async function syncLegacyEdit(userId, { legacy } = {}) {
        if (!enabled()) return { synced: false };
        try {
            const res = await service.syncFromLegacy(userId, { source: 'manual', legacy });
            return { synced: true, sections: res.changed ? res.sections : [] };
        } catch (err) {
            const level = err instanceof ProfileInputError ? 'legacy data does not fit the schema' : 'sync failed';
            logger.error(`[HealthProfile] user ${userId}: profile edit not synced (${level}: ${err.message})`);
            return { synced: false };
        }
    }

    return { enabled, onSignup, writeWithUser, setDeviceWeight, syncLegacyEdit, invalidate };
}

module.exports = {
    ...createProfileSync(),
    createProfileSync,
    cleanSections,
    positiveNumber,
    LEGACY_PATHS,
};
