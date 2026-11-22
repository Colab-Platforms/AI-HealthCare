// Pure mapping between the legacy User document (User.profile + nutritionGoal)
// and HealthProfile sections. No DB access here — ProfileWriteService and the
// migration script decide when to call these.
//
//   fromLegacyUser(user, source)        legacy  -> HealthProfile sections
//   toLegacyPatch(profile, sections)    HealthProfile -> { $set, $unset } on User
//
// Mirror rules (see docs/ai-coach-technical-spec.md):
// - toLegacyPatch only touches the legacy paths of the sections passed in, so a
//   write to `body` can never rewrite a user's conditions.
// - It never touches app settings that also live under User.profile
//   (lifestyle.waterGoalMl, waterGlassSizeMl, stepGoal, sleepGoalHours, avatar...).
// - diabetesProfile, dietPreferences, fitnessProfile and foodPreferences keep
//   their own write flows in v1 and are not mirrored.

// Mirrors the enum on User.profile.healthConditions. A condition outside this
// list is written to chronicConditions instead (the enum would reject it).
const ONBOARDING_CONDITIONS = [
    'Diabetes', 'Hypertension', 'High Cholesterol', 'Thyroid', 'PCOS',
    'Vitamin Deficiency', 'Gut Health Issues', 'Heart Disease',
];
const ONBOARDING_GOALS = [
    'Better Sleep', 'Improve Energy', 'Weight Management', 'Build Muscle',
    'Better Nutrition', 'Reduce Stress', 'Healthy Ageing', 'Understand My Health',
    'Manage Diabetes', 'Heart Health', 'Boost Immunity', 'Overall Wellness', 'Other',
];

const DIABETES_TYPE_NAMES = {
    'Type 1': 'Type 1 Diabetes',
    'Type 2': 'Type 2 Diabetes',
    Prediabetes: 'Prediabetes',
    Gestational: 'Gestational Diabetes',
};
const DIABETES_STATUS = { Controlled: 'controlled', Uncontrolled: 'active', 'Newly diagnosed': 'active' };

const isPrediabetes = (name) => /prediabet/i.test(name);
const isDiabetes = (name) => /diabet/i.test(name) && !isPrediabetes(name);

const clean = (v) => (typeof v === 'string' ? v.trim() : v);
const has = (v) => v !== undefined && v !== null && v !== '';
const strings = (arr) => (Array.isArray(arr) ? arr.map(clean).filter((s) => typeof s === 'string' && s) : []);

// Case-insensitive dedupe that keeps the first spelling seen.
function dedupe(names) {
    const seen = new Set();
    return names.filter((n) => {
        const k = n.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

// Drops undefined keys so an empty legacy field never becomes an explicit value.
function compact(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) if (has(v)) out[k] = v;
    return out;
}

function scalarSection(fields, source, at) {
    const data = compact(fields);
    if (Object.keys(data).length === 0) return undefined;
    return { ...data, meta: { source, verified: true, updatedAt: at } };
}

function list(items) {
    return { state: items.length ? 'has_items' : 'missing', items };
}

// ── legacy -> HealthProfile ─────────────────────────────────────────────────

function mapConditions(p, source, at) {
    const medical = p.medicalHistory || {};
    const dp = p.diabetesProfile || {};
    const onboarding = strings(p.healthConditions);
    const saidNone = onboarding.includes('None of these');

    let names = [
        ...onboarding.filter((c) => c !== 'None of these' && c !== 'Other'),
        ...strings([p.healthConditionOther]),
        ...strings(p.chronicConditions),
        ...strings(medical.conditions),
    ];

    // isDiabetic / diabetesProfile give the most specific diabetes name.
    const diabetesName = DIABETES_TYPE_NAMES[dp.type] || (p.isDiabetic === 'yes' ? 'Diabetes' : null);
    if (diabetesName) names.push(diabetesName);
    // Keep the specific name only: "Type 2 Diabetes" makes a generic "Diabetes" redundant.
    if (names.some((n) => isDiabetes(n) && n.toLowerCase() !== 'diabetes')) {
        names = names.filter((n) => n.toLowerCase() !== 'diabetes');
    }

    const items = dedupe(names).map((name) => {
        const isDiab = /diabet/i.test(name);
        return compact({
            name,
            status: (isDiab && DIABETES_STATUS[dp.status]) || 'unknown',
            diagnosedYear: isDiab ? dp.diagnosisYear : undefined,
            source,
            verified: true,
            updatedAt: at,
        });
    });

    if (items.length) return list(items);
    return { state: saidNone ? 'none' : 'missing', items: [] };
}

const toItems = (arr, key, source, at) =>
    dedupe(strings(arr)).map((v) => ({ [key]: v, source, verified: true, updatedAt: at }));

const boolToHabit = (b) => (b === true ? 'current' : b === false ? 'no' : undefined);

function fromLegacyUser(user, source = 'migration', at = new Date()) {
    const p = (user && user.profile) || {};
    const medical = p.medicalHistory || {};
    const life = p.lifestyle || {};
    const ng = (user && user.nutritionGoal) || {};

    const sections = {
        basic: scalarSection({
            age: p.age,
            dateOfBirth: p.dateOfBirth,
            gender: p.gender,
            bloodGroup: clean(p.bloodGroup),
        }, source, at),
        body: scalarSection({ heightCm: p.height, weightKg: p.weight }, source, at),
        conditions: mapConditions(p, source, at),
        medications: list(toItems(medical.currentMedications, 'name', source, at)),
        allergies: list(toItems(p.allergies, 'allergen', source, at)),
        surgeries: list(toItems(medical.surgeries, 'name', source, at)),
        familyHistory: list(toItems(medical.familyHistory, 'condition', source, at)),
        lifestyle: scalarSection({
            smoking: boolToHabit(life.smoker),
            smokingFrequency: clean(life.smokingFrequency),
            alcohol: boolToHabit(life.alcohol),
            alcoholFrequency: clean(life.alcoholFrequency),
            sleepHours: life.sleepHours,
            stressLevel: life.stressLevel,
            profession: p.profession,
            activityLevel: p.activityLevel,
        }, source, at),
        diet: scalarSection({ preference: p.dietaryPreference }, source, at),
        goals: scalarSection({
            primary: strings(p.goals).length ? strings(p.goals) : undefined,
            other: clean(p.goalOther),
            targetWeightKg: ng.targetWeight,
        }, source, at),
    };

    for (const k of Object.keys(sections)) if (sections[k] === undefined) delete sections[k];
    return sections;
}

// ── HealthProfile -> legacy mirror patch ────────────────────────────────────

const activeConditions = (hp) =>
    ((hp.conditions && hp.conditions.items) || []).filter((c) => c.status !== 'resolved').map((c) => c.name);

function canonicalOnboardingCondition(name) {
    if (isDiabetes(name)) return 'Diabetes';
    return ONBOARDING_CONDITIONS.find((c) => c.toLowerCase() === name.toLowerCase()) || null;
}

// Each entry returns the legacy fields for one section. A value of undefined
// means "unset this legacy path".
const LEGACY_WRITERS = {
    basic: (hp) => ({
        'profile.age': hp.basic && hp.basic.age,
        'profile.dateOfBirth': hp.basic && hp.basic.dateOfBirth,
        'profile.gender': hp.basic && hp.basic.gender,
        'profile.bloodGroup': hp.basic && hp.basic.bloodGroup,
    }),
    body: (hp) => ({
        'profile.height': hp.body && hp.body.heightCm,
        'profile.weight': hp.body && hp.body.weightKg,
    }),
    conditions: (hp) => {
        const names = activeConditions(hp);
        const onboarding = [];
        const chronic = [];
        for (const n of names) {
            const c = canonicalOnboardingCondition(n);
            if (c) onboarding.push(c);
            else chronic.push(n);
        }
        const saidNone = hp.conditions && hp.conditions.state === 'none';
        return {
            'profile.healthConditions': saidNone ? ['None of these'] : (onboarding.length ? dedupe(onboarding) : undefined),
            'profile.healthConditionOther': undefined,
            'profile.chronicConditions': dedupe(chronic),
            'profile.medicalHistory.conditions': [],
            'profile.isDiabetic': names.some(isDiabetes) ? 'yes' : 'no',
        };
    },
    medications: (hp) => ({
        'profile.medicalHistory.currentMedications': ((hp.medications && hp.medications.items) || [])
            .filter((m) => m.active !== false)
            .map((m) => (m.dose ? `${m.name} ${m.dose}` : m.name)),
    }),
    allergies: (hp) => ({
        'profile.allergies': ((hp.allergies && hp.allergies.items) || []).map((a) => a.allergen),
    }),
    surgeries: (hp) => ({
        'profile.medicalHistory.surgeries': ((hp.surgeries && hp.surgeries.items) || []).map((s) => s.name),
    }),
    familyHistory: (hp) => ({
        'profile.medicalHistory.familyHistory': ((hp.familyHistory && hp.familyHistory.items) || [])
            .map((f) => (f.relation ? `${f.relation}: ${f.condition}` : f.condition)),
    }),
    lifestyle: (hp) => {
        const l = hp.lifestyle || {};
        return {
            'profile.lifestyle.smoker': l.smoking === 'current',
            'profile.lifestyle.smokingFrequency': l.smokingFrequency,
            'profile.lifestyle.alcohol': l.alcohol === 'current',
            'profile.lifestyle.alcoholFrequency': l.alcoholFrequency,
            'profile.lifestyle.sleepHours': l.sleepHours,
            'profile.lifestyle.stressLevel': l.stressLevel,
            'profile.profession': l.profession,
            'profile.activityLevel': l.activityLevel,
        };
    },
    diet: (hp) => ({ 'profile.dietaryPreference': hp.diet && hp.diet.preference }),
    goals: (hp) => {
        const g = hp.goals || {};
        const primary = strings(g.primary).filter((x) => ONBOARDING_GOALS.includes(x));
        return {
            'profile.goals': primary.length ? primary : undefined,
            'profile.goalOther': g.other,
            'nutritionGoal.targetWeight': g.targetWeightKg,
        };
    },
};

// Sections with no legacy counterpart (fitness, coachPreferences) are ignored.
function toLegacyPatch(healthProfile, sections) {
    const $set = {};
    const $unset = {};
    for (const section of sections) {
        const writer = LEGACY_WRITERS[section];
        if (!writer) continue;
        for (const [path, value] of Object.entries(writer(healthProfile || {}))) {
            if (has(value)) $set[path] = value;
            else $unset[path] = '';
        }
    }
    const patch = {};
    if (Object.keys($set).length) patch.$set = $set;
    if (Object.keys($unset).length) patch.$unset = $unset;
    return patch;
}

module.exports = {
    fromLegacyUser,
    toLegacyPatch,
    MIRRORED_SECTIONS: Object.keys(LEGACY_WRITERS),
    ONBOARDING_CONDITIONS,
};
