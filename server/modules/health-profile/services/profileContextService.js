const HealthProfile = require('../models/HealthProfile');
const writeService = require('./profileWriteService');
const { mongoRepo, VersionConflictError } = require('./profileRepo');
const { fromLegacyUser } = require('./profileMapper');
const { computeCompleteness } = require('./completeness');
const { buildSafetyConstraints, foodRulesText, exerciseRulesText } = require('./safetyConstraints');

// The read side of the health profile.
//
//   getProfile(userId)         full profile for the app (GET /api/health-profile)
//   getProfileContext(userId)  compact, cached summary for AI features. Every AI
//                              feature reads the profile through this, never
//                              User.profile directly.
//
// Cache: `profile:ctx:{userId}:v2`, cleared by ProfileWriteService after every
// committed write (pattern `profile:ctx:{userId}:*`). The TTL is a backstop for
// the rare read-before-invalidate race, not the main freshness mechanism.

const CONTEXT_TTL_SECONDS = 15 * 60;
const contextKey = (userId) => `profile:ctx:${userId}:v3`; // v3 (26 Nov): diabetes / diet / fitness details + safety rules

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
        disabilities: items(doc.disabilities, (d) => ({ name: d.name, area: d.area, severity: d.severity, aid: d.aid, notes: d.notes })),
        intolerances: items(doc.intolerances, (i) => ({ name: i.name, severity: i.severity, reaction: i.reaction })),
        mentalHealth: items(doc.mentalHealth, (m) => ({ name: m.name, status: m.status, treatment: m.treatment, since: m.since })),
        lifestyle: stripMeta(doc.lifestyle),
        diet: stripMeta(doc.diet),
        fitness: stripMeta(doc.fitness),
        goals: stripMeta(doc.goals),
        diabetes: stripMeta(doc.diabetes),
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
    if (ctx.diet) {
        const d = ctx.diet;
        const parts = [d.preference, d.cuisinePreference && `cuisine ${d.cuisinePreference}`, d.mealsPerDay && `${d.mealsPerDay} meals a day`,
            d.restrictions?.length && `restrictions: ${d.restrictions.join(', ')}`,
            d.dietaryRestrictions?.length && `also avoids for health / religion: ${d.dietaryRestrictions.join(', ')}`,
            d.dislikes?.length && `does not want: ${d.dislikes.join(', ')}`, d.likes?.length && `likes: ${d.likes.join(', ')}`,
            d.region && `${d.region} Indian food`].filter(Boolean);
        if (parts.length) lines.push(`Diet: ${parts.join(', ')}`);
    }
    if (ctx.diabetes) {
        const d = ctx.diabetes;
        const parts = [d.type, d.status && d.status.toLowerCase(), d.diagnosisYear && `since ${d.diagnosisYear}`,
            d.hba1c != null && `HbA1c ${d.hba1c}% (self-reported)`,
            d.onMedication === true && `on medication${d.medicationType?.length ? ` (${d.medicationType.join(', ')})` : ''}`,
            d.onMedication === false && 'no diabetes medication', d.insulinTiming && `insulin ${d.insulinTiming}`,
            d.glucoseMonitoring && `monitors with ${d.glucoseMonitoring}`, d.testingFrequency && `tests ${d.testingFrequency}`,
            d.fastingGlucose && `usual fasting sugar ${d.fastingGlucose}`, d.postMealGlucose && `after meals ${d.postMealGlucose}`,
            d.recentDosageChange === true && 'dose changed recently'].filter(Boolean);
        if (parts.length) lines.push(`Diabetes: ${parts.join(', ')}`);
    }
    if (ctx.lifestyle) {
        const l = ctx.lifestyle;
        const parts = [
            l.smoking && `smoking ${l.smoking}`, l.alcohol && `alcohol ${l.alcohol}`,
            l.activityLevel && `activity ${l.activityLevel}`, l.sleepHours != null && `sleep ${l.sleepHours}h`,
            l.stressLevel && `stress ${l.stressLevel}`, l.profession && `work ${l.profession}`,
        ].filter(Boolean);
        if (parts.length) lines.push(`Lifestyle: ${parts.join(', ')}`);
    }
    // Said only once asked (no "not asked yet" line for everyone).
    if (ctx.intolerances?.state === 'none') lines.push('Food intolerances: none');
    else if (ctx.intolerances?.items?.length) {
        lines.push(`Food intolerances: ${ctx.intolerances.items.map((i) => [i.name, i.severity && i.severity !== 'unknown' && i.severity, i.reaction && `(${i.reaction})`].filter(Boolean).join(' ')).join('; ')}`);
    }
    if (ctx.mentalHealth?.items?.length) {
        lines.push(`Mental health (bring up only if the user does; be gentle, never diagnose): ${ctx.mentalHealth.items.map((m) => [m.name, m.status && m.status !== 'unknown' && m.status, m.treatment && !['unknown', 'none'].includes(m.treatment) && `on ${m.treatment}`].filter(Boolean).join(', ')).join('; ')}`);
    }
    if (ctx.disabilities?.state === 'none') lines.push('Physical disabilities: none');
    else if (ctx.disabilities?.items?.length) {
        lines.push(`Physical disabilities: ${ctx.disabilities.items.map((d) => [d.name, d.severity && d.severity !== 'unknown' && d.severity, d.aid && `uses ${d.aid}`].filter(Boolean).join(', ')).join('; ')}`);
    }
    if (ctx.fitness?.limitations?.length) lines.push(`Exercise limitations: ${ctx.fitness.limitations.join(', ')}`);
    if (ctx.fitness) {
        const f = ctx.fitness;
        const parts = [f.preferredExercise?.length && `likes ${f.preferredExercise.join(', ')}`, f.experience && `${f.experience} level`,
            f.primaryGoal && `fitness goal: ${f.primaryGoal}`, f.biggestChallenge && `biggest challenge: ${f.biggestChallenge}`].filter(Boolean);
        if (parts.length) lines.push(`Fitness: ${parts.join(', ')}`);
    }
    if (ctx.goals) {
        const g = ctx.goals;
        const parts = [...(g.primary || []), g.other, g.targetWeightKg && `target weight ${g.targetWeightKg} kg`, g.timeline && `timeline ${g.timeline}`].filter(Boolean);
        if (parts.length) lines.push(`Goals: ${parts.join(', ')}`);
    }
    ctx.summary = lines.join('\n');
    // The same safety rules the meal plan uses (services/safetyConstraints).
    const sc = buildSafetyConstraints(doc, { age: ctx.basic.age });
    ctx.safety = { food: foodRulesText(sc), exercise: exerciseRulesText(sc) };
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
