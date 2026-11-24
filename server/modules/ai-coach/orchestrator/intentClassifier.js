// Intent classifier + profile-fact extractor: ONE Haiku 5.5 call per message
// (one call, not two, keeps the first token fast).
//
// - Greetings / thanks skip the model entirely (fast path).
// - Structured output (JSON schema) so the result is always parseable.
// - If the model is slow, errors or refuses, keyword routing takes over: the
//   coach answers with less precision instead of failing.

const { MODELS, EFFORT, MAX_TOKENS, TIMEOUTS, CLASSIFIER_THINKING } = require('../config');

const SPECIALISTS = ['recovery', 'sleep', 'nutrition', 'fitness', 'medical_lab', 'progress'];
const TOPICS = ['recovery', 'sleep', 'nutrition', 'supplements', 'fitness', 'medical_lab', 'stress', 'general'];
const INTENTS = ['greeting', 'thanks', 'small_talk', 'health_coaching', 'data_question', 'medical_question', 'profile_update', 'off_topic', 'other'];
const TIMEFRAMES = ['today', 'yesterday', 'week', 'month', 'unspecified'];
const LANGUAGES = ['english', 'hinglish', 'hindi', 'other'];
const FACT_TARGETS = [
    'allergies', 'medications', 'conditions', 'surgeries', 'familyHistory', 'fitness.limitations',
    'diet.preference', 'basic.age', 'body.heightCm', 'body.weightKg',
    'lifestyle.smoking', 'lifestyle.alcohol', 'lifestyle.sleepHours', 'lifestyle.stressLevel',
];

const SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['intent', 'topics', 'specialists', 'timeframe', 'lookbackDays', 'symptoms', 'symptomUpdates', 'redFlag', 'distress', 'language', 'recommendsFoodOrSupplement', 'facts', 'mealLog'],
    properties: {
        intent: { type: 'string', enum: INTENTS },
        topics: { type: 'array', items: { type: 'string', enum: TOPICS } },
        specialists: { type: 'array', items: { type: 'string', enum: SPECIALISTS } },
        timeframe: { type: 'string', enum: TIMEFRAMES },
        lookbackDays: { type: 'integer' },
        symptoms: { type: 'array', items: { type: 'string' } },
        symptomUpdates: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['name', 'status'],
                properties: {
                    name: { type: 'string' },
                    status: { type: 'string', enum: ['better', 'same', 'worse', 'resolved'] },
                },
            },
        },
        redFlag: { type: 'boolean' },
        distress: { type: 'boolean' },
        language: { type: 'string', enum: LANGUAGES },
        recommendsFoodOrSupplement: { type: 'boolean' },
        mealLog: {
            type: 'object',
            additionalProperties: false,
            required: ['isLogging', 'mealType', 'description', 'statedCalories', 'statedProtein', 'statedCarbs', 'statedFats'],
            properties: {
                isLogging: { type: 'boolean' },
                mealType: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack', 'unknown'] },
                description: { type: 'string' },
                statedCalories: { type: 'number' },
                statedProtein: { type: 'number' },
                statedCarbs: { type: 'number' },
                statedFats: { type: 'number' },
            },
        },
        facts: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['target', 'value', 'none', 'statedAs', 'aboutSelf'],
                properties: {
                    target: { type: 'string', enum: FACT_TARGETS },
                    value: { type: 'string' },
                    none: { type: 'boolean' },
                    statedAs: { type: 'string', enum: ['answer', 'volunteered', 'question', 'hypothetical'] },
                    aboutSelf: { type: 'boolean' },
                },
            },
        },
    },
};

// Static, so it caches across every user and request.
const SYSTEM = `You route messages for a health coaching app (users in India; English, Hindi or Hinglish). Return JSON only, matching the schema.

Fields:
- intent: greeting | thanks | small_talk | health_coaching (advice about their own health, body, habits, workouts, food) | data_question (asks for their own numbers: "how did I sleep") | medical_question (about a disease, medicine, test or symptom) | profile_update (only tells a fact about themselves) | off_topic (nothing to do with health, body, fitness, food, sleep, mood, medical reports or the take.health app: coding, homework, politics, news, trivia, celebrities, writing essays, other apps; general health knowledge like "what is cholesterol" is NOT off_topic; a message mixing both is NOT off_topic) | other.
- topics: every topic the message touches. "supplements" for vitamins, protein powder, any supplement. "general" if none fits.
- specialists: which data the answer needs. recovery = readiness, HRV, resting heart rate, tiredness, soreness; sleep = sleep amount or quality; nutrition = food, calories, water, diet; fitness = workouts, steps, activity, gym; medical_lab = lab reports and test values; progress = am I improving / hitting my goals / week-over-week comparison. Empty for greetings and general knowledge questions that don't depend on the user's data.
- timeframe: the period the user means. "unspecified" if none.
- lookbackDays: how many days back the question needs data for, if it asks about a longer period ("last 6 months" = 180, "since June", "this year", "compared to 3 months ago" = 90). 0 if it is about today / recent days or not about the past.
- symptoms: NEW symptoms the user says THEY have now, short English words ("fatigue", "headache", "stomach burning"). Not ones already on record (below) and not ones they say are gone. Empty otherwise.
- symptomUpdates: when the user says how a symptom ON RECORD (listed below) is now: name exactly as listed, status better / same / worse / resolved ("theek ho gaya", "gone", "no more pain" = resolved; "thoda kam" = better; "abhi bhi" = same). Only resolved if they clearly say it's gone. Empty otherwise.
- redFlag: true only for possible emergencies: chest pain, trouble breathing, fainting, stroke signs, seizure, heavy bleeding, severe allergic reaction, very high or low blood sugar, thoughts of suicide or self-harm.
- distress: true if the user sounds very upset, hopeless or panicked.
- language: the language of the user's message. Hinglish = Hindi written in Latin letters, often mixed with English.
- recommendsFoodOrSupplement: true if a good answer would recommend specific foods, meals, a diet plan or supplements.
- mealLog: isLogging = true when the user tells you what they ATE or DRANK (past or just now: "maine 2 roti dal khayi", "had oats for breakfast", "lunch was 500 kcal with 30 g protein"), not when asking what to eat. mealType as they said it, else "unknown". description = the food and quantities in short English ("2 roti, 1 bowl dal"). stated* = numbers the user SAID for the whole meal (kcal, grams), else -1. Never estimate them yourself. When isLogging is false: mealType "unknown", description "", all stated* -1.
- facts: lasting facts about the user's own health in THIS message that belong in their profile (allergies, medicines, conditions, surgeries, family history, injuries/limitations, diet type, age, height, weight, smoking, alcohol, usual sleep hours, stress level). Not today's symptoms, not moods, not one-off meals.
  - target: where it goes. value: the fact in short English ("Peanut", "Metformin 500mg", "Type 2 Diabetes", "knee pain", "vegetarian", "32", "170", "68.5", "current", "6", "high"). Units: age in years, height in cm, weight in kg (convert if given otherwise).
  - none: true if the user says they have none ("no allergies", "koi dawai nahi") - then value is "".
  - Only a specific value counts ("knee pain", "Metformin", "Peanut"). If the user only says yes / that they have one without saying what ("haan", "yes I have an injury", "ek dawai leta hoon"), return NO fact for it. Never write "unspecified", "unknown" or "yes" as a value.
  - statedAs: "answer" if it answers the coach's pending question (given below), "volunteered" if told unprompted, "question" if they are asking ("do I have diabetes?"), "hypothetical" if not a real fact ("what if I had...").
  - aboutSelf: false if the fact is about someone else ("my mother has diabetes" is familyHistory with aboutSelf true, since it describes the user's family history; "my friend is diabetic" is aboutSelf false).`;

// ── fast path ───────────────────────────────────────────────────────────────

const GREETING_RE = /^\s*(hi+|hello+|hey+|hii+|namaste|namaskar|good (morning|afternoon|evening|night)|gm|yo)[\s!.,]*$/i;
const THANKS_RE = /^\s*(thanks?|thank you|thx|ty|shukriya|dhanyavaad|dhanyawad|ok(ay)?|got it|cool|great|nice)( (so much|a lot|bro|bhai))?[\s!.,🙏👍]*$/i;

function fastPath(message) {
    if (GREETING_RE.test(message)) return base({ intent: 'greeting', source: 'fast_path' });
    if (THANKS_RE.test(message)) return base({ intent: 'thanks', source: 'fast_path' });
    return null;
}

function base(over = {}) {
    return {
        intent: 'other', topics: [], specialists: [], timeframe: 'unspecified', lookbackDays: 0, symptoms: [], symptomUpdates: [],
        redFlag: false, distress: false, language: 'english', recommendsFoodOrSupplement: false, facts: [], mealLog: { ...NO_MEAL },
        source: 'model', ...over,
    };
}

// ── keyword fallback (model unavailable) ────────────────────────────────────

const KEYWORDS = {
    recovery: /\b(tired|fatigue|exhausted|sore|soreness|recovery|hrv|resting heart|thakan|thaka|thaki|energy)\b/i,
    sleep: /\b(sleep|slept|insomnia|nap|neend|soya|soyi|so nahi)\b/i,
    nutrition: /\b(eat|ate|food|meal|diet|calorie|protein|carb|breakfast|lunch|dinner|snack|water|khana|khaana|nashta)\b/i,
    fitness: /\b(gym|workout|exercise|run|running|walk|steps|cardio|weights|yoga|training|kasrat)\b/i,
    medical_lab: /\b(report|lab|test|blood test|hba1c|cholesterol|vitamin d|b12|thyroid|tsh|lipid|cbc)\b/i,
};
const SUPPLEMENT_RE = /\b(supplement|vitamin|protein powder|whey|creatine|multivitamin|omega)\b/i;
const { detectLanguage } = require('./language');

function keywordFallback(message, reason) {
    const specialists = SPECIALISTS.filter((s) => KEYWORDS[s]?.test(message));
    const topics = [...specialists];
    if (SUPPLEMENT_RE.test(message)) topics.push('supplements');
    return base({
        intent: specialists.length ? 'health_coaching' : 'other',
        topics: topics.length ? topics : ['general'],
        specialists,
        // 'neutral' ("ok", "72") is resolved to the conversation's language by the graph.
        language: ((l) => (l === 'neutral' ? 'english' : l))(detectLanguage(message)),
        source: 'fallback',
        fallbackReason: reason,
    });
}

// ── model call ──────────────────────────────────────────────────────────────

const NO_MEAL = { isLogging: false, mealType: 'unknown', description: '', statedCalories: -1, statedProtein: -1, statedCarbs: -1, statedFats: -1 };

// Stated numbers: finite and in a sane range, else -1 ("not said").
function sanitizeMealLog(m) {
    if (!m || m.isLogging !== true || typeof m.description !== 'string' || !m.description.trim()) return { ...NO_MEAL };
    const n = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : -1);
    return {
        isLogging: true,
        mealType: ['breakfast', 'lunch', 'dinner', 'snack'].includes(m.mealType) ? m.mealType : 'unknown',
        description: m.description.trim().slice(0, 500),
        statedCalories: n(m.statedCalories, 5000),
        statedProtein: n(m.statedProtein, 400),
        statedCarbs: n(m.statedCarbs, 800),
        statedFats: n(m.statedFats, 400),
    };
}

function sanitize(raw) {
    const pick = (arr, allowed) => (Array.isArray(arr) ? [...new Set(arr.filter((x) => allowed.includes(x)))] : []);
    return base({
        intent: INTENTS.includes(raw.intent) ? raw.intent : 'other',
        topics: pick(raw.topics, TOPICS),
        specialists: pick(raw.specialists, SPECIALISTS),
        timeframe: TIMEFRAMES.includes(raw.timeframe) ? raw.timeframe : 'unspecified',
        lookbackDays: Number.isInteger(raw.lookbackDays) ? Math.min(365, Math.max(0, raw.lookbackDays)) : 0,
        symptoms: Array.isArray(raw.symptoms) ? raw.symptoms.filter((s) => typeof s === 'string' && s.trim()).slice(0, 10) : [],
        symptomUpdates: Array.isArray(raw.symptomUpdates)
            ? raw.symptomUpdates.filter((u) => u && typeof u.name === 'string' && ['better', 'same', 'worse', 'resolved'].includes(u.status)).slice(0, 10)
            : [],
        redFlag: raw.redFlag === true,
        distress: raw.distress === true,
        language: LANGUAGES.includes(raw.language) ? raw.language : 'english',
        recommendsFoodOrSupplement: raw.recommendsFoodOrSupplement === true,
        mealLog: sanitizeMealLog(raw.mealLog),
        facts: Array.isArray(raw.facts)
            ? raw.facts.filter((f) => f && FACT_TARGETS.includes(f.target) && typeof f.value === 'string').slice(0, 10)
            : [],
    });
}

/**
 * @param message         the user's message
 * @param history         recent [{ role, content }] (oldest first)
 * @param pendingQuestion { field, question } the coach asked last turn, or null
 * @param client          Anthropic client (injected)
 * @param onUsage         (usage, model) => void, for UsageLog
 */
async function classify({ message, history = [], pendingQuestion = null, activeSymptoms = [], client, onUsage }) {
    const fast = fastPath(message);
    if (fast && !pendingQuestion) return fast;

    // Last 2 turns only: enough to resolve "and tomorrow?" without paying for the whole chat.
    const recent = history.slice(-4).map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${String(m.content).slice(0, 400)}`).join('\n');
    const prompt = [
        recent ? `Recent conversation:\n${recent}` : null,
        pendingQuestion ? `The coach's pending question (answers to it have statedAs "answer"): ${pendingQuestion.question} [field: ${pendingQuestion.field}]` : null,
        activeSymptoms.length ? `Symptoms on record (not yet resolved): ${activeSymptoms.join('; ')}` : null,
        `Message to classify:\n${message}`,
    ].filter(Boolean).join('\n\n');

    try {
        const response = await client.messages.create({
            model: MODELS.classifier,
            max_tokens: MAX_TOKENS.classifier,
            // Routing is a lookup task: no thinking needed, and thinking is the
            // slow part of a small call. Haiku 5.5 accepts "disabled" at low effort.
            thinking: CLASSIFIER_THINKING,
            output_config: { effort: EFFORT.classifier, format: { type: 'json_schema', schema: SCHEMA } },
            system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: prompt }],
        }, { timeout: TIMEOUTS.classifier, maxRetries: 0 });

        if (onUsage) onUsage(response.usage, MODELS.classifier);
        if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
            return keywordFallback(message, response.stop_reason);
        }
        const text = response.content.find((b) => b.type === 'text')?.text;
        return sanitize(JSON.parse(text));
    } catch (err) {
        return keywordFallback(message, err.name || 'error');
    }
}

module.exports = { classify, fastPath, keywordFallback, sanitize, sanitizeMealLog, SPECIALISTS, TOPICS, FACT_TARGETS, CLASSIFIER_SCHEMA: SCHEMA };
