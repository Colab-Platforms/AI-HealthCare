// Reply mode (25 Nov, user request): talk like a person, give data only when
// it is asked for.
//
//   chat      casual / emotional / vague ("kuch sahi nahi lag raha"): no numbers
//             at all; the model gets NO data, so it can't recite any
//   specific  "aaj kitne steps hue?": only the data for what was asked
//   coaching  "gym jaun?", "plan my day": the data that decision needs
//
// The classifier decides the mode; on the fast path (answer starts before the
// classifier) these rules decide it from the message.

// Metric -> the specialist that has its data. Metrics without one are answered
// from the profile / app targets, or honestly reported as not visible here.
const METRIC_SPECIALISTS = {
    steps: 'fitness', activity: 'fitness', workouts: 'fitness',
    sleep: 'sleep',
    recovery: 'recovery', heart: 'recovery',
    calories: 'nutrition', protein: 'nutrition', food: 'nutrition', water: 'nutrition',
    reports: 'medical_lab', sugar: 'medical_lab',
    goals: 'progress',
    smoking: 'habits', alcohol: 'habits',
};
// Answered from the profile block / app targets, no specialist needed.
const PROFILE_METRICS = new Set(['weight']);
// No data source in the coach yet: say so instead of guessing.
const UNAVAILABLE_METRICS = new Set(['bp']);

const METRIC_WORDS = [
    ['steps', /\b(steps?|kadam|chala|chali|walked)\b/i],
    ['sleep', /\b(sleep|slept|neend|soya|soyi)\b/i],
    ['recovery', /\b(recovery|hrv|readiness)\b/i],
    ['heart', /\b(heart rate|bpm|pulse|dhadkan|resting heart)\b/i],
    ['calories', /\b(calories?|kcal|cal)\b/i],
    ['protein', /\bprotein\b/i],
    ['water', /\b(water|paani|pani)\b/i],
    ['weight', /\b(weight|wajan|vajan|wazan)\b/i],
    ['sugar', /\b(sugar|glucose|hba1c)\b/i],
    ['bp', /\b(bp|blood pressure)\b/i],
    ['workouts', /\b(workouts?|exercise|gym)\b/i],
    ['reports', /\b(reports?|lab|test results?)\b/i],
    ['goals', /\b(goals?|targets?|progress)\b/i],
    ['smoking', /\b(cigarettes?|smok\w*|sutta)\b/i],
    ['alcohol', /\b(alcohol|drinks?|beer|daaru|sharab|peg)\b/i],
];

const QUESTION_RE = /\?|\b(kitna|kitne|kitni|kaisa|kaisi|kaise|kya|kab|kyun|kyu|kaun|how|what|why|when|which|did|was|is my|am i|should|can i|batao|bata|dikhao|plan|suggest|recommend|chahiye|karun|karu|jaun|jau|khaun|khau|lun|lu|help)\b/i;
// "How many / how was / show me": asking for their numbers, not for advice.
const DATA_QUESTION_RE = /\b(kitna|kitne|kitni|how many|how much|how did|how was|how is my|kaisi rahi|kaisa raha|kaisi thi|kaisa tha|dikhao|show me|what is my|what's my|mera|meri|mere|my)\b/i;
const ADVICE_RE = /\b(should|kya karun|kya karu|jaun|jau|khaun|khau|plan|suggest|recommend|tips?|improve|badhau|badhaun|kam karun|kaise (badh|kam|sudhar)|help me|kya karna)\b/i;

function metricsFromMessage(message) {
    return METRIC_WORDS.filter(([, re]) => re.test(message)).map(([m]) => m);
}

// Fast-path stand-in for the classifier's replyMode / askedMetrics.
// Rhetorical "kya batau / kya bolu / pata nahi kya" are not questions.
const RHETORICAL_RE = /\b(kya+ (batau|bataun|bolu|bolun|kahu|kahun|karu yaar)|pata nahi kya|what can i say|what to say)\b/gi;

// Requests without a question word ("meal generate karo", "plan do") and
// plans / activities ("I've to go to the gym", "dinner karna hai") want
// coaching, not just a friendly chat.
const REQUEST_RE = /\b(karo|kar do|kardo|do|de do|dedo|bana do|banao|bata do|sunao|bhejo|chahiye|give|tell me|show|make|generate|create|need|want)\b/i;
const ACTIVITY_PLAN_RE = /\b(gym|workout|exercise|run|running|jog|walk|yoga|train|training|khana|khaana|eat|meal|breakfast|lunch|dinner|diet|have to|need to|going to|jaana|jana|karna hai|karni hai|plan)\b/i;

function provisionalReplyMode(message) {
    const text = String(message || '').replace(RHETORICAL_RE, ' ');
    const metrics = metricsFromMessage(text);
    if (!QUESTION_RE.test(text) && !REQUEST_RE.test(text) && !ACTIVITY_PLAN_RE.test(text)) return { replyMode: 'chat', askedMetrics: [] };
    if (metrics.length && DATA_QUESTION_RE.test(text) && !ADVICE_RE.test(text)) return { replyMode: 'specific', askedMetrics: metrics };
    return { replyMode: 'coaching', askedMetrics: metrics };
}

// The specialists a "specific" question needs, added to what the classifier
// picked, so an asked-for number is always fetched instead of guessed.
function specialistsForMetrics(metrics = []) {
    return [...new Set(metrics.map((m) => METRIC_SPECIALISTS[m]).filter(Boolean))];
}

/**
 * What the answer model may see, by mode.
 * @returns { specialistResults, targets, focusMetrics, unavailableMetrics, chat }
 */
function scopeData({ classification = {}, specialistResults = [], targets = null }) {
    const mode = classification.replyMode || 'coaching';
    if (mode === 'chat') return { specialistResults: [], targets: null, focusMetrics: [], unavailableMetrics: [], chat: true };
    const metrics = classification.askedMetrics || [];
    if (mode === 'specific' && metrics.length) {
        const wanted = new Set(specialistsForMetrics(metrics));
        const needsTargets = metrics.some((m) => ['steps', 'calories', 'protein', 'water', 'sleep', 'workouts', 'goals'].includes(m));
        return {
            specialistResults: specialistResults.filter((r) => wanted.has(r.specialist)),
            targets: needsTargets ? targets : null,
            focusMetrics: metrics,
            unavailableMetrics: metrics.filter((m) => UNAVAILABLE_METRICS.has(m)),
            chat: false,
        };
    }
    return { specialistResults, targets, focusMetrics: [], unavailableMetrics: metrics.filter((m) => UNAVAILABLE_METRICS.has(m)), chat: false };
}

module.exports = { provisionalReplyMode, metricsFromMessage, specialistsForMetrics, scopeData, METRIC_SPECIALISTS, PROFILE_METRICS, UNAVAILABLE_METRICS };
