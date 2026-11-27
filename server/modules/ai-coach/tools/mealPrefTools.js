// "Add this kind of meal to my 7-day plan": the coach offers it after meal
// suggestions; on "yes", the meal PATTERNS from that reply are saved to
// User.foodPreferences.mealPreferences.{breakfast,lunch,snacks,dinner}.
// The 7-day plan generator (services/dietRecommendationAI.js) already reads
// those as favourites and avoids repeating the previous plan's dishes, so the
// next plan follows the pattern with daily variety.
//
// The patterns are extracted only when the user says yes (no cost otherwise),
// with one small Haiku call on the stored reply text.

const { MODELS, CLASSIFIER_THINKING } = require('../config');

const SLOTS = ['breakfast', 'lunch', 'snacks', 'dinner'];
const MAX_PER_SLOT = 6;

const SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['patterns'],
    properties: {
        patterns: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['slot', 'pattern'],
                properties: {
                    slot: { type: 'string', enum: SLOTS },
                    pattern: { type: 'string' },
                },
            },
        },
    },
};

const SYSTEM = `Extract the meal patterns a health coach suggested, for saving as the user's meal-plan favourites. Return JSON only.
- One entry per suggested meal: slot = breakfast, lunch, snacks (any snack / mid-morning / evening) or dinner.
- pattern = the dish idea in a few words, without amounts or calories ("paneer bhurji with multigrain roti", "moong dal chilla with curd"). If alternatives are given ("X or Y"), take the first.
- Skip drinks-only advice, tips and anything that isn't a meal.`;

async function extractPatterns({ client, replyText, onUsage }) {
    const response = await client.messages.create({
        model: MODELS.classifier,
        max_tokens: 800,
        thinking: CLASSIFIER_THINKING,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content: String(replyText).slice(0, 4000) }],
    }, { timeout: 8000, maxRetries: 1 });
    if (onUsage) onUsage(response.usage, MODELS.classifier);
    if (response.stop_reason !== 'end_turn') return [];
    const raw = JSON.parse(response.content.find((b) => b.type === 'text')?.text || '{}');
    return (raw.patterns || [])
        .filter((p) => SLOTS.includes(p.slot) && typeof p.pattern === 'string' && p.pattern.trim())
        .map((p) => ({ slot: p.slot, pattern: p.pattern.trim().slice(0, 120) }));
}

// New patterns first, case-insensitive dedupe, capped per slot (oldest drop off).
function mergePatterns(existing = {}, patterns = []) {
    const out = {};
    for (const slot of SLOTS) {
        const fresh = patterns.filter((p) => p.slot === slot).map((p) => p.pattern);
        const seen = new Set();
        out[slot] = [...fresh, ...(existing[slot] || [])]
            .filter((x) => { const k = String(x).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
            .slice(0, MAX_PER_SLOT);
    }
    return out;
}

function createMealPrefTools({
    // Meal patterns live in HealthProfile diet.mealPatterns (the old
    // foodPreferences.mealPreferences, 26 Nov).
    loadPrefs = async (userId) => {
        const HealthProfile = require('../../health-profile/models/HealthProfile');
        return (await HealthProfile.findOne({ user: userId }).select('diet.mealPatterns').lean())?.diet?.mealPatterns || {};
    },
    savePrefs = async (userId, mealPreferences) => {
        const writeService = require('../../health-profile/services/profileWriteService');
        await writeService.updateSection(userId, 'diet', { mealPatterns: mealPreferences }, { source: 'chat' });
    },
    logger = console,
} = {}) {
    // Returns the saved patterns ([] if nothing could be extracted / saved).
    async function savePatternsFromReply(userId, { client, replyText, onUsage }) {
        try {
            const patterns = await extractPatterns({ client, replyText, onUsage });
            if (!patterns.length) return [];
            await savePrefs(userId, mergePatterns(await loadPrefs(userId), patterns));
            return patterns;
        } catch (err) {
            logger.error(`[AICoach] meal pattern not saved: ${err.message}`);
            return [];
        }
    }
    return { savePatternsFromReply };
}

module.exports = { createMealPrefTools, extractPatterns, mergePatterns, SLOTS };
