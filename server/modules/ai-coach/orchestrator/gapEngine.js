// Gap engine: which ONE missing profile fact (if any) the coach should ask
// about in this reply. Pure function, no DB, no LLM.
//
// Rules (docs/ai-coach-technical-spec.md, section 7 + 23 Nov decisions):
// - at most one question per reply;
// - the question goes at the END of the answer; it blocks the answer only when
//   advice without it could be unsafe (supplements with medicines unknown, a
//   food / supplement recommendation with allergies unknown);
// - a field asked within GAP_SNOOZE_DAYS is not asked again;
// - never during a red flag, distress, greeting or small talk.
//
// "Answered" means the user gave a value OR said none. Lists use their state;
// fitness.limitations is an array that defaults to [], so "no injuries" is
// stored as ['none'] (an empty array means never asked).

const { GAP_SNOOZE_DAYS } = require('../config');

const listAnswered = (ctx, key) => ['none', 'has_items'].includes(ctx?.[key]?.state);
const has = (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);

// field -> how to tell it's answered, and the question in both languages
const FIELDS = {
    allergies: {
        answered: (c) => listAnswered(c, 'allergies'),
        en: 'Do you have any food or medicine allergies?',
        hi: 'Kisi khane ya dawai se allergy hai?',
    },
    medications: {
        answered: (c) => listAnswered(c, 'medications'),
        en: 'Are you taking any medicines or supplements right now?',
        hi: 'Abhi koi dawai ya supplement chal raha hai?',
    },
    conditions: {
        answered: (c) => listAnswered(c, 'conditions'),
        en: 'Do you have any health conditions, like diabetes, BP or thyroid?',
        hi: 'Koi health condition hai, jaise diabetes, BP ya thyroid?',
    },
    'fitness.limitations': {
        answered: (c) => has(c?.fitness?.limitations),
        en: 'Any injury or pain I should keep in mind for workouts?',
        hi: 'Workout ke liye koi injury ya dard hai jo mujhe dhyan mein rakhna chahiye?',
    },
    'diet.preference': {
        answered: (c) => has(c?.diet?.preference),
        en: 'Are you vegetarian, non-vegetarian, eggetarian, vegan or Jain?',
        hi: 'Diet kaunsi hai: vegetarian, non-veg, eggetarian, vegan ya Jain?',
    },
    basics: {
        answered: (c) => has(c?.basic?.age) && has(c?.body?.heightCm) && has(c?.body?.weightKg),
        en: 'To make this more personal, could you share your age, height and weight?',
        hi: 'Isse aur personal banane ke liye: age, height aur weight kitna hai?',
    },
};

// topic -> fields in the order they are asked
const TOPIC_FIELDS = {
    nutrition: ['allergies', 'diet.preference', 'conditions'],
    supplements: ['medications', 'allergies', 'conditions'],
    fitness: ['fitness.limitations', 'conditions'],
    recovery: ['conditions'],
    sleep: [],
    medical_lab: ['conditions', 'medications'],
    stress: [],
    general: ['basics'],
};

// When a message touches several topics, the more specific / riskier one picks
// the question first ("tired + gym" asks about injuries before conditions).
const TOPIC_PRIORITY = ['supplements', 'nutrition', 'fitness', 'medical_lab', 'recovery', 'sleep', 'stress', 'general'];

const NO_QUESTION_INTENTS = new Set(['greeting', 'small_talk', 'thanks']);

function isSnoozed(askedLog, field, now) {
    const at = askedLog?.[field];
    if (!at) return false;
    const t = new Date(at).getTime();
    return Number.isFinite(t) && now.getTime() - t < GAP_SNOOZE_DAYS * 86400000;
}

function isBlocking(field, classification) {
    const topics = classification.topics || [];
    if (field === 'medications' && topics.includes('supplements')) return true;
    if (field === 'allergies' && classification.recommendsFoodOrSupplement) return true;
    return false;
}

/**
 * @param classification  classifier output ({ intent, topics, redFlag, distress, language, recommendsFoodOrSupplement })
 * @param profileContext  getProfileContext() result
 * @param askedLog        { [field]: ISO date } of earlier coach questions
 * @returns { field, question, blocking } or null
 */
function pickGapQuestion(classification, profileContext, askedLog = {}, now = new Date()) {
    if (!classification || classification.redFlag || classification.distress) return null;
    if (NO_QUESTION_INTENTS.has(classification.intent)) return null;

    const topics = (classification.topics?.length ? [...classification.topics] : ['general'])
        .sort((a, b) => TOPIC_PRIORITY.indexOf(a) - TOPIC_PRIORITY.indexOf(b));
    const seen = new Set();
    const candidates = [];
    for (const topic of topics) {
        for (const field of TOPIC_FIELDS[topic] || []) {
            if (!seen.has(field)) { seen.add(field); candidates.push(field); }
        }
    }

    const hinglish = ['hinglish', 'hindi'].includes(classification.language);
    // Blocking fields first: they matter for safety.
    candidates.sort((a, b) => Number(isBlocking(b, classification)) - Number(isBlocking(a, classification)));
    for (const field of candidates) {
        const def = FIELDS[field];
        if (!def || def.answered(profileContext) || isSnoozed(askedLog, field, now)) continue;
        // Both wordings go to the answer model, which asks in its reply's language.
        return { field, question: hinglish ? def.hi : def.en, questionAlt: hinglish ? def.en : def.hi, blocking: isBlocking(field, classification) };
    }
    return null;
}

module.exports = { pickGapQuestion, GAP_FIELDS: Object.keys(FIELDS), TOPIC_FIELDS };
