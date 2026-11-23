// How complete a HealthProfile is, and which fields are still unanswered.
// Pure function, no DB. Used by GET /api/health-profile/completeness (app
// nudges) and by the coach's gap engine (which question to ask next).
//
// A list counts as answered when the user gave items OR said "none";
// only `missing` (never asked) is unanswered. Weights: critical 3,
// important 2, optional 1.

const WEIGHT = { critical: 3, important: 2, optional: 1 };

const has = (v) => v !== undefined && v !== null && v !== ''
    && !(Array.isArray(v) && v.length === 0);
const listAnswered = (list) => Boolean(list && (list.state === 'none' || list.state === 'has_items'));

// Order matters: within a priority, earlier fields are asked first.
const FIELDS = [
    // critical: needed for safe advice (allergies before any food advice, etc.)
    { field: 'allergies', priority: 'critical', answered: (p) => listAnswered(p.allergies) },
    { field: 'medications', priority: 'critical', answered: (p) => listAnswered(p.medications) },
    { field: 'conditions', priority: 'critical', answered: (p) => listAnswered(p.conditions) },
    { field: 'basic.age', priority: 'critical', answered: (p) => has(p.basic?.age) || has(p.basic?.dateOfBirth) },
    { field: 'basic.gender', priority: 'critical', answered: (p) => has(p.basic?.gender) },
    { field: 'body.heightCm', priority: 'critical', answered: (p) => has(p.body?.heightCm) },
    { field: 'body.weightKg', priority: 'critical', answered: (p) => has(p.body?.weightKg) },
    // important: changes the advice noticeably
    { field: 'diet.preference', priority: 'important', answered: (p) => has(p.diet?.preference) },
    { field: 'goals.primary', priority: 'important', answered: (p) => has(p.goals?.primary) || has(p.goals?.other) },
    { field: 'lifestyle.activityLevel', priority: 'important', answered: (p) => has(p.lifestyle?.activityLevel) },
    { field: 'lifestyle.smoking', priority: 'important', answered: (p) => has(p.lifestyle?.smoking) },
    { field: 'lifestyle.alcohol', priority: 'important', answered: (p) => has(p.lifestyle?.alcohol) },
    { field: 'lifestyle.sleepHours', priority: 'important', answered: (p) => has(p.lifestyle?.sleepHours) },
    // optional: nice to have
    { field: 'familyHistory', priority: 'optional', answered: (p) => listAnswered(p.familyHistory) },
    { field: 'surgeries', priority: 'optional', answered: (p) => listAnswered(p.surgeries) },
    { field: 'lifestyle.stressLevel', priority: 'optional', answered: (p) => has(p.lifestyle?.stressLevel) },
    { field: 'lifestyle.profession', priority: 'optional', answered: (p) => has(p.lifestyle?.profession) },
    { field: 'basic.bloodGroup', priority: 'optional', answered: (p) => has(p.basic?.bloodGroup) },
    { field: 'fitness.experience', priority: 'optional', answered: (p) => has(p.fitness?.experience) },
];

const TOTAL_WEIGHT = FIELDS.reduce((sum, f) => sum + WEIGHT[f.priority], 0);

function computeCompleteness(profile) {
    const p = profile || {};
    let answeredWeight = 0;
    const missing = [];
    for (const f of FIELDS) {
        if (f.answered(p)) answeredWeight += WEIGHT[f.priority];
        else missing.push({ field: f.field, priority: f.priority });
    }
    return {
        percent: Math.round((answeredWeight / TOTAL_WEIGHT) * 100),
        answered: FIELDS.length - missing.length,
        total: FIELDS.length,
        missingCritical: missing.filter((m) => m.priority === 'critical').length,
        missing, // most important first
    };
}

module.exports = { computeCompleteness, COMPLETENESS_FIELDS: FIELDS.map(({ field, priority }) => ({ field, priority })) };
