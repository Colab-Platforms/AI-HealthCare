// Glue between POST /api/chat (routes/chatRoutes.js) and the Coach V2 graph.
//
// Same endpoint, same SSE format: every client gets `data: {"token": ...}`
// chunks and `data: [DONE]`. Typed events (profile_saved / profile_undone /
// profile_confirm) are sent ONLY when the app opts in with
// `"coachEvents": true` in the request body: an older app that looks for
// `token` in every event would otherwise print "undefined".
//
// Returns true when V2 answered. Returns false when V2 is off or failed before
// sending anything, so the route runs the old chat as before (rollback = flag off).

const Anthropic = require('@anthropic-ai/sdk');
const { isEnabled, HISTORY_TURNS } = require('./config');
const { runCoach } = require('./orchestrator/mainCoachGraph');

const TYPED_EVENTS = new Set(['profile_saved', 'profile_undone', 'profile_confirm', 'meal_pref_saved', 'food_log_confirm', 'food_logged']);

let sharedDeps;
function defaultDeps() {
    if (sharedDeps) return sharedDeps;
    const { getProfileContext } = require('../health-profile/services/profileContextService');
    const { mongoRepo } = require('./orchestrator/coachStateRepo');
    const { createProfileTools } = require('./tools/profileTools');
    const { getTargets } = require('./context/targets');
    const { getFreshness } = require('./context/freshness');
    const { createSymptomTools } = require('./tools/symptomTools');
    const { createMealPrefTools } = require('./tools/mealPrefTools');
    const { createFoodLogTools } = require('./tools/foodLogTools');
    sharedDeps = {
        mealPrefTools: createMealPrefTools(),
        foodLogTools: createFoodLogTools(),
        client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
        getProfileContext,
        getTargets,
        getFreshness,
        symptomTools: createSymptomTools(),
        coachStateRepo: mongoRepo,
        profileTools: createProfileTools(),
        specialistDeps: {},
        logger: console,
    };
    return sharedDeps;
}

function cleanHistory(conversationHistory) {
    if (!Array.isArray(conversationHistory)) return [];
    return conversationHistory
        .filter((m) => m && typeof m.content === 'string' && m.content.trim())
        .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
        .slice(-HISTORY_TURNS * 2);
}

function logUsage(userId, entries, durationMs) {
    const UsageLog = require('../../models/UsageLog');
    for (const e of entries || []) {
        UsageLog.create({
            userId,
            feature: e.feature,
            model: e.model,
            inputTokens: e.usage?.input_tokens || 0,
            outputTokens: e.usage?.output_tokens || 0,
            cacheReadTokens: e.usage?.cache_read_input_tokens || 0,
            cacheWriteTokens: e.usage?.cache_creation_input_tokens || 0,
            durationMs,
            status: 'success',
        }).catch((err) => console.error('[AICoach] UsageLog save failed:', err.message));
    }
}

/**
 * @param req          Express request (after protect + consent + limiter + feature checks)
 * @param sendToken    (text) => void      writes { token }
 * @param sendEvent    (object) => void    writes a raw JSON event
 * @param finishStream () => void          writes [DONE] and ends
 */
async function handleCoachV2({ req, sendToken, sendEvent, finishStream, deps }) {
    if (!isEnabled() || !process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant')) return false;

    const user = req.user;
    const wantsEvents = req.body?.coachEvents === true;
    const abort = new AbortController();
    // `res` close = the client went away (on current Node, `req` close fires
    // once the request body is read, not on disconnect).
    const res = req.res;
    if (res?.on) res.on('close', () => { if (!res.writableEnded) abort.abort(); });

    let sentText = false;
    const started = Date.now();
    try {
        const final = await runCoach({
            input: {
                userId: user._id,
                userName: user.name,
                message: String(req.body.query),
                history: cleanHistory(req.body.conversationHistory),
                now: new Date(),
                startedAt: started,
            },
            deps: { ...(deps || defaultDeps()), signal: abort.signal },
            onEvent: (event) => {
                if (event.type === 'token') {
                    sentText = true;
                    sendToken(event.text);
                } else if (wantsEvents && TYPED_EVENTS.has(event.type)) {
                    sendEvent(event);
                }
            },
        });
        logUsage(user._id, final?.usage, Date.now() - started);
        finishStream();
        return true;
    } catch (err) {
        if (abort.signal.aborted) return true; // client left; nothing to send
        console.error(`[AICoach] V2 failed for user ${user._id}: ${err.message}`);
        if (!sentText) return false; // old chat answers instead
        sendToken('\n\nSorry, I lost my train of thought there. Please ask again.');
        finishStream();
        return true;
    }
}

module.exports = { handleCoachV2, cleanHistory, TYPED_EVENTS };
