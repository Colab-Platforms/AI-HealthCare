// 7-day meal plan x health profile (27 Nov). Pure. Same dish rules as the
// meal log / scan (foodRules.dishViolations), applied to every option.
//
//   checkPlan(mealPlan, facts)  -> issues [{ slot, dayIndex, dish, code, level, text }]
//   fixPlan(mealPlan, facts)    -> { mealPlan, fixed: [{ slot, dayIndex, from, to }], remaining }
//   planAlerts({ issues, fixed }) -> alerts for the guard (one line per problem, grouped)
//
// Used twice: right after generation (fixPlan: a dish the user must not eat is
// swapped for a clean dish of the same slot from another day), and on every
// read (checkPlan against the CURRENT profile, so an allergy added after the
// plan was made still shows on the plan).

const { analyzeDish, dishViolations, TEXT } = require('./foodRules');

const SLOTS = ['breakfast', 'midMorningSnack', 'lunch', 'eveningSnack', 'dinner'];
const SLOT_LABEL = {
    breakfast: ['breakfast', 'breakfast'], midMorningSnack: ['mid-morning snack', 'mid-morning snack'],
    lunch: ['lunch', 'lunch'], eveningSnack: ['evening snack', 'shaam ka snack'], dinner: ['dinner', 'dinner'],
};
// Problems that make a dish wrong to serve (swap it); others are only flagged.
const BLOCKING = new Set(['meal_allergy', 'meal_celiac', 'meal_diet_clash', 'meal_jain', 'meal_restriction', 'meal_intolerance', 'meal_avoid']);

function optionDish(opt) {
    if (!opt) return null;
    const names = (opt.items || []).map((i) => i && i.name).filter(Boolean);
    return { name: opt.name || names.join(', '), ingredients: [...(opt.ingredients || []), ...names] };
}

function optionIssues(opt, facts) {
    const dish = optionDish(opt);
    if (!dish || !dish.name) return [];
    return dishViolations(analyzeDish(dish), facts);
}

function checkPlan(mealPlan, facts) {
    const issues = [];
    if (!mealPlan || !facts) return issues;
    for (const slot of SLOTS) {
        (mealPlan[slot] || []).forEach((opt, dayIndex) => {
            for (const v of optionIssues(opt, facts)) {
                issues.push({ slot, dayIndex, dish: v.detail.dish, code: v.code, level: v.level, detail: v.detail });
            }
        });
    }
    return issues;
}

function fixPlan(mealPlan, facts) {
    if (!mealPlan || !facts) return { mealPlan, fixed: [], remaining: [] };
    const out = { ...mealPlan };
    const fixed = [];
    for (const slot of SLOTS) {
        const options = Array.isArray(mealPlan[slot]) ? [...mealPlan[slot]] : null;
        if (!options) continue;
        const bad = options.map((o) => optionIssues(o, facts).some((v) => BLOCKING.has(v.code)));
        const clean = options.map((o, i) => (!bad[i] && o ? i : -1)).filter((i) => i >= 0);
        options.forEach((opt, i) => {
            if (!bad[i] || !clean.length) return;
            // Nearest clean day, so the week still varies as much as it can.
            const j = clean.reduce((best, c) => (Math.abs(c - i) < Math.abs(best - i) ? c : best), clean[0]);
            const src = typeof options[j]?.toObject === 'function' ? options[j].toObject() : options[j];
            fixed.push({ slot, dayIndex: i, from: optionDish(opt).name, to: optionDish(src).name });
            options[i] = JSON.parse(JSON.stringify(src));
        });
        out[slot] = options;
    }
    return { mealPlan: out, fixed, remaining: checkPlan(out, facts) };
}

// Alerts for the coach / response. Each problem once (same code + same thing),
// with where it is ("Day 3 lunch").
function planAlerts({ issues = [], fixed = [] } = {}) {
    const alerts = [];
    const groups = new Map();
    for (const i of issues) {
        const key = `${i.code}:${(i.detail && (i.detail.what || i.detail.diet)) || ''}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(i);
    }
    for (const list of groups.values()) {
        const first = list[0];
        const where = (hi) => list.slice(0, 3).map((x) => `Day ${x.dayIndex + 1} ${SLOT_LABEL[x.slot][hi ? 1 : 0]}`).join(', ') + (list.length > 3 ? (hi ? ` +${list.length - 3} aur` : ` +${list.length - 3} more`) : '');
        const t = TEXT[first.code](first.detail, 'precheck');
        alerts.push({
            code: `plan_${first.code.replace(/^meal_/, '')}`,
            level: first.level,
            text: {
                english: `${where(false)}: ${t.english} Tap "regenerate" on that meal for a new one.`,
                hinglish: `${where(true)}: ${t.hinglish} Us meal pe "regenerate" dabaiye, naya mil jaayega.`,
            },
        });
    }
    if (fixed.length) {
        const n = fixed.length;
        alerts.push({
            code: 'plan_fixed',
            level: 'caution',
            text: {
                english: `${n} dish${n === 1 ? '' : 'es'} didn't fit your profile (allergy / diet / foods to avoid), so I swapped ${n === 1 ? 'it' : 'them'} for safe meals from your plan.`,
                hinglish: `${n} dish aapke profile (allergy / diet / foods to avoid) se match nahi kar rahi thi, isliye maine unhe aapke plan ke safe meals se badal diya.`,
            },
        });
    }
    const rank = { important: 0, caution: 1 };
    return alerts.sort((a, b) => rank[a.level] - rank[b.level]);
}

// Per-option warnings to show on the plan screen: { 'lunch:2': ['...'] }.
function warningsByOption(issues, language = 'english') {
    const out = {};
    for (const i of issues) {
        const k = `${i.slot}:${i.dayIndex}`;
        (out[k] ||= []).push(TEXT[i.code](i.detail, 'precheck')[language]);
    }
    return out;
}

module.exports = { checkPlan, fixPlan, planAlerts, warningsByOption, SLOTS, BLOCKING };
