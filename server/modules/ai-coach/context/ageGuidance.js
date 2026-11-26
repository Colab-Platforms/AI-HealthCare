// Age-aware coaching rules, decided in code (not left to the model's own
// judgement). The age group and its short rules go into "Data for this
// message", so a 67-year-old with knee pain and a 24-year-old lifter get
// different advice for the same question every time.
//
// Bands follow the app's own split (exerciseGuidanceService: <=17 youth,
// 18-64 adult, 65+ older adult), with 50-64 split out because joint care,
// muscle loss and screening start to matter there.

function ageBand(age) {
    if (typeof age !== 'number' || !Number.isFinite(age) || age <= 0) return null;
    if (age < 18) return 'teen';
    if (age < 50) return 'adult';
    if (age < 65) return 'midlife';
    return 'older';
}

const LABELS = {
    teen: 'under 18',
    adult: '18-49',
    midlife: '50-64',
    older: 'older adult, 65+',
};

const RULES = {
    teen: [
        'Under 18: never suggest a calorie deficit, crash diet, fasting or a weight-loss target; focus on regular balanced meals, sports, play and sleep.',
        'No supplements (protein powder, creatine, fat burners, pre-workout) unless a doctor advised them.',
        'For anything medical or a big change, suggest involving a parent or guardian and a doctor.',
    ],
    adult: [],
    midlife: [
        'Age 50-64: prefer joint-friendly cardio (brisk walking, cycling, swimming) and keep strength training at least 2 days a week, since muscle loss starts at this age. Warm up well.',
        'Recovery takes longer than in their 20s: no back-to-back hard days.',
        'Where relevant, remind that regular BP, sugar and cholesterol checks matter at this age.',
    ],
    older: [
        '65+: prefer low-impact exercise (walking, cycling, swimming, chair exercises, gentle yoga). No jumping, high-intensity intervals or lifting to failure unless they already train that way regularly.',
        'Include simple balance work (standing on one leg near a wall or chair, heel-to-toe walk) to prevent falls, plus 2 days a week of gentle strength.',
        'Longer warm-up and cool-down, an easy day between harder sessions, and after any illness or injury a slower, step-by-step return.',
        'Progress is slower at this age and that is normal: about 0.25-0.5 kg a week of weight loss is a good pace. Praise small gains, never push faster.',
        'Keep protein in every meal to protect muscle (within the app targets). Never suggest crash diets or long fasting, especially with diabetes or BP medicines.',
        'Thirst gets weaker with age: remind them to sip water through the day.',
        'Dizziness on standing up, especially with BP medicines, or any fall is worth telling a doctor.',
    ],
};

const BONE_HEALTH = 'Woman over 45: bones weaken after menopause, so include bone health where it fits: calcium-rich foods (milk, curd, paneer, ragi, til), vitamin D (morning sun, a test if not done), and weight-bearing or strength exercise.';

// -> { band, text } or null when the age is unknown or there is nothing to add.
function ageGuidance({ age, gender } = {}) {
    const band = ageBand(age);
    if (!band) return null;
    const rules = [...RULES[band]];
    if (String(gender || '').toLowerCase() === 'female' && age >= 45) rules.push(BONE_HEALTH);
    if (!rules.length) return null;
    return {
        band,
        text: `Age group: ${LABELS[band]} (age ${age}). Coach with this in mind:\n${rules.map((r) => `- ${r}`).join('\n')}`,
    };
}

module.exports = { ageBand, ageGuidance, RULES };
