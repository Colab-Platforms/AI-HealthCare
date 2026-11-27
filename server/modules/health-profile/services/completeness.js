// How complete a HealthProfile is, and which fields are still unanswered.
// Pure function, no DB. Used by GET /api/health-profile/completeness, the
// `completeness` block on every profile GET / write response (app progress
// bar), and the coach prompt.
//
// A list counts as answered when the user gave items OR said "none";
// only `missing` (never asked) is unanswered. Weights: critical 3,
// important 2, optional 1.
//
// Each field has:
//   section     screen group the app shows a percent for (basic, body, medical, ...)
//   editSection API section to open for editing (PATCH /:section or /:section/items)
//   label       { english, hinglish } for the "what's missing" list

const WEIGHT = { critical: 3, important: 2, optional: 1 };

const SECTIONS = [
    { key: 'basic', label: { english: 'Basic info', hinglish: 'Basic info' } },
    { key: 'body', label: { english: 'Body', hinglish: 'Body' } },
    { key: 'medical', label: { english: 'Medical', hinglish: 'Medical' } },
    { key: 'lifestyle', label: { english: 'Lifestyle', hinglish: 'Lifestyle' } },
    { key: 'diet', label: { english: 'Diet', hinglish: 'Diet' } },
    { key: 'goals', label: { english: 'Goals', hinglish: 'Goals' } },
    { key: 'fitness', label: { english: 'Fitness', hinglish: 'Fitness' } },
];

const has = (v) => v !== undefined && v !== null && v !== ''
    && !(Array.isArray(v) && v.length === 0);
const listAnswered = (list) => Boolean(list && (list.state === 'none' || list.state === 'has_items'));

const L = (english, hinglish) => ({ english, hinglish });

// Order matters: within a priority, earlier fields are asked first.
const FIELDS = [
    // critical: needed for safe advice (allergies before any food advice, etc.)
    { field: 'allergies', priority: 'critical', section: 'medical', label: L('Allergies', 'Allergy'), answered: (p) => listAnswered(p.allergies) },
    { field: 'medications', priority: 'critical', section: 'medical', label: L('Medicines you take', 'Aap kaunsi dawai lete hain'), answered: (p) => listAnswered(p.medications) },
    { field: 'conditions', priority: 'critical', section: 'medical', label: L('Health conditions', 'Health conditions / bimari'), answered: (p) => listAnswered(p.conditions) },
    { field: 'basic.age', priority: 'critical', section: 'basic', label: L('Age / date of birth', 'Umar / date of birth'), answered: (p) => has(p.basic?.age) || has(p.basic?.dateOfBirth) },
    { field: 'basic.gender', priority: 'critical', section: 'basic', label: L('Gender', 'Gender'), answered: (p) => has(p.basic?.gender) },
    { field: 'body.heightCm', priority: 'critical', section: 'body', label: L('Height', 'Height'), answered: (p) => has(p.body?.heightCm) },
    { field: 'body.weightKg', priority: 'critical', section: 'body', label: L('Weight', 'Weight'), answered: (p) => has(p.body?.weightKg) },
    // important: changes the advice noticeably
    { field: 'diet.preference', priority: 'important', section: 'diet', label: L('Diet type (veg / non-veg ...)', 'Diet type (veg / non-veg ...)'), answered: (p) => has(p.diet?.preference) },
    { field: 'goals.primary', priority: 'important', section: 'goals', label: L('Your health goal', 'Aapka health goal'), answered: (p) => has(p.goals?.primary) || has(p.goals?.other) },
    { field: 'lifestyle.activityLevel', priority: 'important', section: 'lifestyle', label: L('How active you are', 'Aap kitne active hain'), answered: (p) => has(p.lifestyle?.activityLevel) },
    { field: 'lifestyle.smoking', priority: 'important', section: 'lifestyle', label: L('Smoking', 'Smoking'), answered: (p) => has(p.lifestyle?.smoking) },
    { field: 'lifestyle.alcohol', priority: 'important', section: 'lifestyle', label: L('Alcohol', 'Alcohol'), answered: (p) => has(p.lifestyle?.alcohol) },
    { field: 'lifestyle.sleepHours', priority: 'important', section: 'lifestyle', label: L('Sleep hours', 'Neend ke ghante'), answered: (p) => has(p.lifestyle?.sleepHours) },
    // optional: nice to have
    { field: 'intolerances', priority: 'optional', section: 'medical', label: L('Food intolerances (lactose, gluten ...)', 'Food intolerance (lactose, gluten ...)'), answered: (p) => listAnswered(p.intolerances) },
    { field: 'familyHistory', priority: 'optional', section: 'medical', label: L('Family health history', 'Family ki health history'), answered: (p) => listAnswered(p.familyHistory) },
    { field: 'surgeries', priority: 'optional', section: 'medical', label: L('Past surgeries', 'Pehle hui surgery'), answered: (p) => listAnswered(p.surgeries) },
    { field: 'mentalHealth', priority: 'optional', section: 'medical', label: L('Mental health', 'Mental health'), answered: (p) => listAnswered(p.mentalHealth) },
    { field: 'disabilities', priority: 'optional', section: 'medical', label: L('Physical disabilities', 'Physical disability'), answered: (p) => listAnswered(p.disabilities) },
    { field: 'lifestyle.stressLevel', priority: 'optional', section: 'lifestyle', label: L('Stress level', 'Stress level'), answered: (p) => has(p.lifestyle?.stressLevel) },
    { field: 'lifestyle.profession', priority: 'optional', section: 'lifestyle', label: L('Type of work', 'Kaam ka type'), answered: (p) => has(p.lifestyle?.profession) },
    { field: 'basic.bloodGroup', priority: 'optional', section: 'basic', label: L('Blood group', 'Blood group'), answered: (p) => has(p.basic?.bloodGroup) },
    { field: 'fitness.experience', priority: 'optional', section: 'fitness', label: L('Fitness level', 'Fitness level'), answered: (p) => has(p.fitness?.experience) },
].map((f) => ({ ...f, editSection: f.field.split('.')[0] }));

const TOTAL_WEIGHT = FIELDS.reduce((sum, f) => sum + WEIGHT[f.priority], 0);
const pct = (got, total) => (total ? Math.round((got / total) * 100) : 100);

function computeCompleteness(profile) {
    const p = profile || {};
    let answeredWeight = 0;
    const missing = [];
    const bySection = Object.fromEntries(SECTIONS.map((s) => [s.key, { got: 0, total: 0, answered: 0, count: 0, missing: [] }]));
    for (const f of FIELDS) {
        const s = bySection[f.section];
        s.total += WEIGHT[f.priority];
        s.count += 1;
        let ok = false;
        try { ok = Boolean(f.answered(p)); } catch { ok = false; }
        if (ok) {
            answeredWeight += WEIGHT[f.priority];
            s.got += WEIGHT[f.priority];
            s.answered += 1;
        } else {
            const m = { field: f.field, priority: f.priority, section: f.section, editSection: f.editSection, label: f.label };
            missing.push(m);
            s.missing.push(f.field);
        }
    }
    return {
        percent: pct(answeredWeight, TOTAL_WEIGHT),
        answered: FIELDS.length - missing.length,
        total: FIELDS.length,
        missingCritical: missing.filter((m) => m.priority === 'critical').length,
        sections: SECTIONS.map(({ key, label }) => {
            const s = bySection[key];
            return { key, label, percent: pct(s.got, s.total), answered: s.answered, total: s.count, missing: s.missing };
        }),
        missing, // most important first
    };
}

// Small block for profile GET / write responses (progress bar + next step).
function completenessSummary(profile) {
    const c = computeCompleteness(profile);
    return {
        percent: c.percent,
        missingCritical: c.missingCritical,
        sections: c.sections.map(({ key, label, percent }) => ({ key, label, percent })),
        next: c.missing[0] || null,
    };
}

module.exports = {
    computeCompleteness,
    completenessSummary,
    COMPLETENESS_FIELDS: FIELDS.map(({ field, priority, section }) => ({ field, priority, section })),
    COMPLETENESS_SECTIONS: SECTIONS.map((s) => s.key),
};
