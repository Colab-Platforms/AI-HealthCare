const HealthProfile = require('../models/HealthProfile');
const writeService = require('./profileWriteService');
const { mongoRepo, VersionConflictError } = require('./profileRepo');
const { fromLegacyUser } = require('./profileMapper');
const { computeCompleteness } = require('./completeness');

// The read side of the health profile.
//
//   getProfile(userId)         full profile for the app (GET /api/health-profile)
//   getProfileContext(userId)  compact, cached summary for AI features. Every AI
//                              feature reads the profile through this, never
//                              User.profile directly.
//
// Cache: `profile:ctx:{userId}:v1`, cleared by ProfileWriteService after every
// committed write (pattern `profile:ctx:{userId}:*`). The TTL is a backstop for
// the rare read-before-invalidate race, not the main freshness mechanism.

const CONTEXT_TTL_SECONDS = 15 * 60;
const contextKey = (userId) => `profile:ctx:${userId}:v1`;

const { SCALAR_SECTIONS, LIST_SECTIONS } = HealthProfile;
const SECTIONS = [...SCALAR_SECTIONS, ...LIST_SECTIONS];

// Only the health sections + version; never internal fields (user ref, __v).
function toView(doc) {
    const profile = {};
    for (const s of SECTIONS) if (doc[s] !== undefined) profile[s] = doc[s];
    for (const s of LIST_SECTIONS) profile[s] ||= { state: 'missing', items: [] };
    return { profile, version: doc.version || 0, updatedAt: doc.updatedAt || null };
}

function ageFrom(basic, now) {
    if (basic?.dateOfBirth) {
        const dob = new Date(basic.dateOfBirth);
        if (!Number.isNaN(dob.getTime())) {
            let age = now.getUTCFullYear() - dob.getUTCFullYear();
            const beforeBirthday = now.getUTCMonth() < dob.getUTCMonth()
                || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
            if (beforeBirthday) age -= 1;
            if (age >= 0 && age <= 120) return age;
        }
    }
    return basic?.age ?? null;
}

const stripMeta = (section) => {
    if (!section) return null;
    const { meta, ...rest } = section;
    return Object.keys(rest).length ? rest : null;
};

// Items without provenance noise; unverified (AI-extracted) facts are flagged.
const items = (list, pick) => ({
    state: list?.state || 'missing',
    items: (list?.items || []).map((i) => ({ ...pick(i), ...(i.verified === false ? { unconfirmed: true } : {}) })),
});

function listLine(label, list, format) {
    if (list.state === 'none') return `${label}: none`;
    if (list.state !== 'has_items' || !list.items.length) return `${label}: not asked yet`;
    return `${label}: ${list.items.map((i) => `${format(i)}${i.unconfirmed ? ' (unconfirmed)' : ''}`).join(', ')}`;
}

// Stored values can carry float noise from old unit conversions
// (56.80000000000001); the AI sees one decimal. Stored data is left as is.
const round1 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : v ?? null);

function buildContext(doc, now = new Date()) {
    const basic = doc.basic || {};
    const body = { ...(doc.body || {}), heightCm: round1(doc.body?.heightCm), weightKg: round1(doc.body?.weightKg) };
    const bmi = body.heightCm && body.weightKg
        ? Number((body.weightKg / ((body.heightCm / 100) ** 2)).toFixed(1))
        : null;

    const ctx = {
        version: doc.version || 0,
        basic: { age: ageFrom(basic, now), gender: basic.gender || null, bloodGroup: basic.bloodGroup || null, city: basic.city || null, state: basic.state || null },
        body: { heightCm: body.heightCm ?? null, weightKg: body.weightKg ?? null, bmi },
        conditions: items(doc.conditions, (c) => ({ name: c.name, status: c.status, diagnosedYear: c.diagnosedYear })),
        medications: items(
            { ...doc.medications, items: (doc.medications?.items || []).filter((m) => m.active !== false) },
            (m) => ({ name: m.name, dose: m.dose, frequency: m.frequency }),
        ),
        allergies: items(doc.allergies, (a) => ({ allergen: a.allergen, type: a.type, severity: a.severity, reaction: a.reaction })),
        surgeries: items(doc.surgeries, (s) => ({ name: s.name, year: s.year })),
        familyHistory: items(doc.familyHistory, (f) => ({ relation: f.relation, condition: f.condition })),
        lifestyle: stripMeta(doc.lifestyle),
        diet: stripMeta(doc.diet),
        fitness: stripMeta(doc.fitness),
        goals: stripMeta(doc.goals),
        coachPreferences: stripMeta(doc.coachPreferences),
    };
    // A medication list whose only items are inactive reads as "none current".
    if (ctx.medications.state === 'has_items' && !ctx.medications.items.length) ctx.medications.state = 'none';

    const c = computeCompleteness(doc);
    ctx.completeness = { percent: c.percent, missingCritical: c.missing.filter((m) => m.priority === 'critical').map((m) => m.field) };

    // Plain-text block for the LLM prompt. Missing is said as missing, never as "none".
    const lines = [
        `Age: ${ctx.basic.age ?? 'unknown'}, gender: ${ctx.basic.gender || 'unknown'}`,
        `Height: ${ctx.body.heightCm ?? 'unknown'} cm, weight: ${ctx.body.weightKg ?? 'unknown'} kg${bmi ? `, BMI ${bmi}` : ''}`,
        listLine('Conditions', ctx.conditions, (i) => `${i.name}${i.status && i.status !== 'unknown' ? ` (${i.status})` : ''}`),
        listLine('Current medications', ctx.medications, (i) => [i.name, i.dose, i.frequency].filter(Boolean).join(' ')),
        listLine('Allergies', ctx.allergies, (i) => `${i.allergen}${i.severity && i.severity !== 'unknown' ? ` (${i.severity})` : ''}`),
        listLine('Surgeries', ctx.surgeries, (i) => `${i.name}${i.year ? ` (${i.year})` : ''}`),
        listLine('Family history', ctx.familyHistory, (i) => (i.relation ? `${i.relation}: ${i.condition}` : i.condition)),
    ];
    if (ctx.diet?.preference) lines.push(`Diet: ${ctx.diet.preference}`);
    if (ctx.lifestyle) {
        const l = ctx.lifestyle;
        const parts = [
            l.smoking && `smoking ${l.smoking}`, l.alcohol && `alcohol ${l.alcohol}`,
            l.activityLevel && `activity ${l.activityLevel}`, l.sleepHours != null && `sleep ${l.sleepHours}h`,
            l.stressLevel && `stress ${l.stressLevel}`, l.profession && `work ${l.profession}`,
        ].filter(Boolean);
        if (parts.length) lines.push(`Lifestyle: ${parts.join(', ')}`);
    }
    if (ctx.fitness?.limitations?.length) lines.push(`Exercise limitations: ${ctx.fitness.limitations.join(', ')}`);
    if (ctx.goals) {
        const g = ctx.goals;
        const parts = [...(g.primary || []), g.other, g.targetWeightKg && `target weight ${g.targetWeightKg} kg`].filter(Boolean);
        if (parts.length) lines.push(`Goals: ${parts.join(', ')}`);
    }
    ctx.summary = lines.join('\n');
    return ctx;
}

function createProfileReadService({
    repo = mongoRepo,
    service = writeService,
    cache = require('../../../utils/cache'),
    logger = console,
    now = () => new Date(),
} = {}) {

    // Full profile for the app. A user with no HealthProfile yet gets one
    // built from their legacy data (same as the first write would do), so
    // every list item has a stable id the app can edit or delete.
    async function getProfile(userId) {
        let doc = await repo.findProfile(userId);
        if (!doc) {
            try {
                const res = await service.ensureProfile(userId);
                doc = res.profile;
            } catch (err) {
                if (err instanceof VersionConflictError) {
                    doc = await repo.findProfile(userId); // a parallel request created it
                } else if (err.status === 400) {
                    // Old data doesn't fit the schema (migration will fix it):
                    // show it read-only instead of failing the screen.
                    logger.error(`[HealthProfile] user ${userId}: cannot create profile from legacy data (${err.message})`);
                    const legacy = await repo.loadLegacyUser(userId, null);
                    if (!legacy) return null;
                    return { ...toView({ ...fromLegacyUser(legacy, 'migration', now()), version: 0 }), exists: false, readOnly: true };
                } else {
                    throw err; // 404 (no such user) and DB errors go to the caller
                }
            }
        }
        if (!doc) return null;
        return { ...toView(doc), exists: true, readOnly: false };
    }

    // Compact summary for AI prompts. Never writes; a user without a profile
    // gets one built in memory from legacy data.
    async function getProfileContext(userId) {
        return cache.getOrSet(contextKey(userId), async () => {
            let doc = await repo.findProfile(userId);
            if (!doc) {
                const legacy = await repo.loadLegacyUser(userId, null);
                if (!legacy) return null;
                doc = { ...fromLegacyUser(legacy, 'migration', now()), version: 0 };
            }
            return buildContext(doc, now());
        }, CONTEXT_TTL_SECONDS);
    }

    return { getProfile, getProfileContext };
}

module.exports = {
    ...createProfileReadService(),
    createProfileReadService,
    buildContext,
    toView,
    contextKey,
};
