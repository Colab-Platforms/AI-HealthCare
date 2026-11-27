// Activity guard: checks what the user is doing against their HealthProfile
// and, when something clashes, has the coach speak up (27 Nov).
//
//   const guard = createActivityGuard();          // deps injectable for tests
//   const { alerts, coach } = await guard.checkExercise(user, activity, { mode });
//
//   alerts  every current alert (empty = nothing to say), in the user's language
//   coach   { open: true, text, language, codes, alertId } when the coach should
//           open with this message now; null when there is nothing NEW to say
//           (same alert already shown within its cooldown) or the user has no
//           coach (plan / consent / AI_COACH_V2 off)
//
// Speed: the profile read is the 10 s in-process cache that `protect` already
// filled for this request; symptoms + coach state are two indexed reads run in
// parallel; the rules are pure. Total ~5 ms. Fail-safe: any error or the time
// budget running out gives "no alert", never a failed request.

const { checkExercise: runExerciseRules, exerciseFacts } = require('./exerciseRules');
const foodRules = require('./foodRules');
const supplementRules = require('./supplementRules');
const goalRules = require('./goalRules');

const HOUR = 3600 * 1000;
// Same alert again only after this long (per code). Important ones sooner:
// if the user still does it hours later, saying it once more is right.
const COOLDOWN_MS = { important: 6 * HOUR, caution: 20 * HOUR };
const SYMPTOM_WINDOW_MS = 3 * 24 * HOUR; // symptoms mentioned in the last 3 days count
const MAX_ALERTS_IN_MESSAGE = 3;
const ALERT_LOG_CAP = 40;
// Warm (normal): ~5-50 ms. The budget only matters on a cold process (first
// plan / Mongo reads); past it the alerts still go out, only the coach part
// is dropped for this call.
const BUDGET_MS = 1500;

const mongoDeps = {
    async loadProfile(userId) {
        const { loadProfile } = require('../profileReadService');
        return loadProfile(userId);
    },
    async loadSymptoms(userId, since) {
        const SymptomLog = require('../../../ai-coach/models/SymptomLog');
        return SymptomLog.find({ user: userId, status: 'active', lastMentionedAt: { $gte: since } })
            .select('name lastMentionedAt').sort({ lastMentionedAt: -1 }).limit(10).lean();
    },
    async loadState(userId) {
        const CoachState = require('../../../ai-coach/models/CoachState');
        return CoachState.findOne({ user: userId }).select('alertLog lastLanguage').lean();
    },
    // Atomic claim: records the alert only if no other request recorded any of
    // these codes in the race window, so two quick requests never both open
    // the coach. false = someone else just did it.
    async claim(userId, { codes, entries, activityAlert, raceSince }) {
        const CoachState = require('../../../ai-coach/models/CoachState');
        try {
            const res = await CoachState.updateOne(
                { user: userId, alertLog: { $not: { $elemMatch: { code: { $in: codes }, at: { $gt: raceSince } } } } },
                { $set: { activityAlert }, $push: { alertLog: { $each: entries, $slice: -ALERT_LOG_CAP } } },
                { upsert: true },
            );
            return (res.modifiedCount || 0) + (res.upsertedCount || 0) > 0;
        } catch (err) {
            if (err && err.code === 11000) return false; // doc exists and a code was claimed
            throw err;
        }
    },
    async coachAvailable(user) {
        const { isEnabled } = require('../../../ai-coach/config');
        if (!isEnabled() || user?.consent?.withdrawn) return false;
        const { hasFeature } = require('../../../../middleware/subscriptionAccess');
        return hasFeature(user, 'aiHealthCoach');
    },
};

// Runs fn(token) with a time limit. When the limit hits, token.expired turns
// true so the late run doesn't record an alert the user never saw, and
// whatever was ready (token.partial: the alerts) is returned.
const withBudget = (fn, ms) => {
    const token = { expired: false };
    let t;
    return Promise.race([fn(token), new Promise((resolve) => { t = setTimeout(() => { token.expired = true; resolve(token.partial || null); }, ms); })])
        .finally(() => clearTimeout(t));
};

const langOf = (state) => (state?.lastLanguage === 'english' ? 'english' : state?.lastLanguage ? 'hinglish' : 'english');

// Intro line per mode. label: "Running", "Lunch", "7-day meal plan" ...
function introLine({ kind, mode, label, hi, name, many }) {
    const what = hi ? (many ? 'kuch zaroori baatein' : 'ek zaroori baat') : (many ? 'a few things' : 'one thing');
    const What = hi ? what : (many ? 'A few things' : 'One thing');
    if (mode === 'precheck') {
        if (kind === 'meal') return hi ? `${name}ye khaane se pehle ${what}, aapke health profile ke hisaab se:` : `${name}before you eat this, ${what} from your health profile:`;
        return hi ? `${name}${label} shuru karne se pehle ${what}, aapke health profile ke hisaab se:` : `${name}before you start ${label.toLowerCase()}, ${what} from your health profile:`;
    }
    if (kind === 'goal') return hi ? `${name}aapka goal set ho gaya. Aapke health profile ke hisaab se ${what}:` : `${name}your goal is set. ${What} from your health profile:`;
    if (mode === 'review') return hi ? `${name}aapke ${label} ke baare mein ${what}, aapke health profile ke hisaab se:` : `${name}about your ${label.toLowerCase()}, ${what} from your health profile:`;
    const done = { logged: ['log ho gaya', 'is logged'], generated: ['ban gaya', 'is ready'], set: ['set ho gaya', 'is set'], added: ['routine mein add ho gaya', 'is added to your routine'] }[mode] || ['ho gaya', 'is done'];
    return hi ? `${name}${label} ${done[0]}. Aapke health profile ke hisaab se ${what}:` : `${name}${label} ${done[1]}. ${What} from your health profile:`;
}

function composeMessage({ alerts, label, mode, kind = 'exercise', language, firstName }) {
    const hi = language === 'hinglish';
    const name = firstName ? `${firstName}, ` : '';
    const many = Math.min(alerts.length, MAX_ALERTS_IN_MESSAGE) > 1;
    const intro = introLine({ kind, mode, label, hi, name, many });
    const lines = alerts.slice(0, MAX_ALERTS_IN_MESSAGE).map((a) => `• ${a.message}`);
    const outro = hi ? 'Kuch bhi poochna ho to yahin poochiye.' : 'Ask me anything about it here.';
    return [intro, ...lines, outro].join('\n');
}

const LEVEL_RANK = { important: 0, caution: 1 };
const EMPTY = () => ({ alerts: [], coach: null });

function createActivityGuard(deps = mongoDeps, { now: clock = () => new Date() } = {}) {
    // spec: { kind, mode, subject, label, evaluate(hp, symptoms) -> [{ code, level, text: { english, hinglish } }],
    //         coachMinLevel?, cooldownMs? (default per level) }
    async function run(user, spec, token) {
        const userId = user._id;
        const now = clock();
        const [hp, symptoms, state] = await Promise.all([
            deps.loadProfile(userId),
            deps.loadSymptoms(userId, new Date(now.getTime() - SYMPTOM_WINDOW_MS)).catch(() => []),
            deps.loadState(userId).catch(() => null),
        ]);
        const raw = spec.evaluate(hp, symptoms) || [];
        if (!raw.length) return EMPTY();

        const language = langOf(state);
        const alerts = raw.map((a) => ({ code: a.code, level: a.level, message: a.text[language] }));
        token.partial = { alerts, coach: null };

        // Only alerts not shown within their cooldown (and serious enough for
        // this screen) open the coach.
        const lastAt = new Map();
        for (const e of state?.alertLog || []) {
            const t = new Date(e.at).getTime();
            if (!lastAt.has(e.code) || t > lastAt.get(e.code)) lastAt.set(e.code, t);
        }
        const minRank = LEVEL_RANK[spec.coachMinLevel || 'caution'];
        const fresh = alerts.filter((a) => LEVEL_RANK[a.level] <= minRank
            && !(now.getTime() - (lastAt.get(a.code) ?? -Infinity) < (spec.cooldownMs ?? COOLDOWN_MS[a.level])));
        if (!fresh.length || !(await deps.coachAvailable(user))) return { alerts, coach: null };

        const firstName = String(user.name || '').trim().split(/\s+/)[0] || '';
        const text = composeMessage({ alerts: fresh, label: spec.label, mode: spec.mode, kind: spec.kind, language, firstName });
        const codes = fresh.map((a) => a.code);
        if (token.expired) return null;
        const claimed = await deps.claim(userId, {
            codes,
            entries: codes.map((code) => ({ code, at: now })),
            activityAlert: { kind: spec.kind, activityType: spec.subject, codes, text, at: now },
            raceSince: new Date(now.getTime() - COOLDOWN_MS.important),
        });
        if (!claimed) return { alerts, coach: null };
        return { alerts, coach: { open: true, text, language, codes, alertId: `${userId}:${now.getTime()}` } };
    }

    async function check(user, spec) {
        if (!user?._id || !spec?.evaluate) return EMPTY();
        try {
            return (await withBudget((token) => run(user, spec, token), BUDGET_MS)) || EMPTY();
        } catch (err) {
            console.error(`[ActivityGuard] ${spec.kind} check failed for ${user._id}: ${err.message}`);
            return EMPTY();
        }
    }

    function checkExercise(user, activity, { mode = 'precheck' } = {}) {
        if (!activity?.activityType) return Promise.resolve(EMPTY());
        const { ACTIVITY_LABEL } = require('../../../../config/activityCatalog');
        return check(user, {
            kind: 'exercise', mode, subject: activity.activityType,
            label: ACTIVITY_LABEL[activity.activityType] || 'Workout',
            evaluate: (hp, symptoms) => runExerciseRules(activity, exerciseFacts(hp, { symptoms })),
        });
    }

    // A meal: logged (mode 'logged') or scanned before eating ('precheck').
    // meal = { dishes: [{ name, ingredients? }], totals: { sugar, sodium, protein }, day: { sugar, sodium } | null, mealType }
    // A scan already shows its own warnings on screen, so there the coach
    // opens only for the serious ones (allergy / celiac).
    function checkMeal(user, meal, { mode = 'logged' } = {}) {
        if (!meal?.dishes?.length) return Promise.resolve(EMPTY());
        const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', snacks: 'Snack' };
        return check(user, {
            kind: 'meal', mode, subject: meal.mealType || 'meal',
            label: MEAL_LABEL[String(meal.mealType || '').toLowerCase()] || 'Meal',
            coachMinLevel: mode === 'precheck' ? 'important' : 'caution',
            evaluate: (hp) => foodRules.checkMeal({ dishes: meal.dishes, meal: meal.totals, day: meal.day }, foodRules.foodFacts(hp), { mode }),
        });
    }

    // A stored 7-day plan, checked against the CURRENT profile on read.
    // alerts come precomputed (planCheck.planAlerts); codes are per plan and
    // never repeat for the same plan, so reading the plan daily doesn't nag.
    function checkPlan(user, { planId, alerts }) {
        if (!alerts?.length) return Promise.resolve(EMPTY());
        return check(user, {
            kind: 'meal_plan', mode: 'review', subject: String(planId), label: '7-day meal plan',
            cooldownMs: Infinity,
            evaluate: () => alerts.map((a) => ({ ...a, code: `${a.code}@${planId}` })),
        });
    }

    // A supplement the user adds to their routine (mode 'added').
    function checkSupplement(user, sup, { mode = 'added' } = {}) {
        if (!sup?.name) return Promise.resolve(EMPTY());
        return check(user, {
            kind: 'supplement', mode, subject: String(sup.name).slice(0, 80), label: String(sup.name).slice(0, 80),
            evaluate: (hp) => supplementRules.checkSupplement(sup, supplementRules.supplementFacts(hp)),
        });
    }

    // AI supplement recommendations: alerts precomputed per supplement; once per recommendation set.
    function checkSupplementPlan(user, { recId, alerts }) {
        if (!alerts?.length) return Promise.resolve(EMPTY());
        return check(user, {
            kind: 'supplement', mode: 'review', subject: String(recId), label: 'supplement suggestions',
            cooldownMs: Infinity,
            evaluate: () => alerts.map((a) => ({ ...a, code: `${a.code}@${recId}` })),
        });
    }

    // A goal the user just set / changed (mode 'set').
    function checkGoal(user, goal) {
        if (!goal?.goalType) return Promise.resolve(EMPTY());
        const g = typeof goal.toObject === 'function' ? goal.toObject() : goal;
        return check(user, {
            kind: 'goal', mode: 'set', subject: g.goalType, label: 'Goal',
            evaluate: (hp) => goalRules.checkGoal(g, hp),
        });
    }

    return { check, checkExercise, checkMeal, checkPlan, checkSupplement, checkSupplementPlan, checkGoal };
}

let defaultGuard;
const getActivityGuard = () => (defaultGuard ||= createActivityGuard());

module.exports = { createActivityGuard, getActivityGuard, composeMessage, COOLDOWN_MS };
