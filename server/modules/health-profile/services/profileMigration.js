const HealthProfile = require('../models/HealthProfile');
const { fromLegacyUser } = require('./profileMapper');

// Logic for scripts/migrateHealthProfile.js (backfill a HealthProfile for every
// existing user). Kept here, without DB access, so it is unit tested.

// Would this user's legacy data make a valid HealthProfile? null = yes,
// otherwise the schema errors ("basic.gender: `robot` is not a valid enum ...").
function validateLegacy(legacyUser) {
    const doc = new HealthProfile({ user: legacyUser._id, version: 1, ...fromLegacyUser(legacyUser, 'migration') });
    const err = doc.validateSync();
    return err ? Object.values(err.errors).map((e) => `${e.path}: ${e.message}`) : null;
}

const has = (v) => v !== undefined && v !== null && v !== '';
const norm = (v) => (has(v) ? v : null);
const nameSet = (arr) => [...new Set((arr || []).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().toLowerCase()))].sort();

// Facts that must agree between User.profile (mirror) and HealthProfile.
// Returns [] when they match, else [{ field, legacy, profile }]. Used to
// spot-check a migration and to detect drift later.
function compareFacts(legacyUser, hp) {
    const p = legacyUser?.profile || {};
    const pairs = [
        ['age', norm(p.age), norm(hp.basic?.age)],
        ['gender', norm(p.gender), norm(hp.basic?.gender)],
        ['height', norm(p.height), norm(hp.body?.heightCm)],
        ['weight', norm(p.weight), norm(hp.body?.weightKg)],
        ['dietaryPreference', norm(p.dietaryPreference), norm(hp.diet?.preference)],
        ['allergies', nameSet(p.allergies), nameSet((hp.allergies?.items || []).map((a) => a.allergen))],
        ['currentMedications',
            nameSet(p.medicalHistory?.currentMedications),
            nameSet((hp.medications?.items || []).filter((m) => m.active !== false).map((m) => (m.dose ? `${m.name} ${m.dose}` : m.name)))],
    ];
    return pairs
        .filter(([, a, b]) => JSON.stringify(a) !== JSON.stringify(b))
        .map(([field, legacy, profile]) => ({ field, legacy, profile }));
}

// One user. `existing` = this user already has a HealthProfile.
// Never throws: every outcome is a status for the report.
async function migrateOne(legacyUser, { existing, apply, service }) {
    if (existing) return { status: 'exists' };
    const invalid = validateLegacy(legacyUser);
    if (invalid) return { status: 'invalid', reasons: invalid };
    if (!apply) return { status: 'would_create' };
    try {
        const res = await service.ensureProfile(legacyUser._id);
        // Live traffic may have created it between the scan and now: still fine.
        return { status: res.changed ? 'created' : 'exists' };
    } catch (err) {
        return { status: err.status === 400 ? 'invalid' : 'error', reasons: [err.message] };
    }
}

module.exports = { validateLegacy, compareFacts, migrateOne };
