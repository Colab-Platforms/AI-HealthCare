// AI Coach V2 flow as a LangGraph graph (no checkpointer: per-user memory
// between messages lives in CoachState). Dependencies (Anthropic client,
// services, repos) come in through config.configurable.deps, so the graph is
// testable without a DB or the API.
//
//   START -> prepare ─┬─ red flag ────────────────> safety ──────┐
//                     ├─ greeting / thanks ───────> quick ───────┤
//                     └─ else -> actions -> gap ─┬─> specialists -> respond ─┤
//                                                └─> respond ────────────────┤
//                                                              persist -> END
//
// Output goes to the "custom" stream through config.writer:
//   { type: 'token', text }                 every client
//   { type: 'profile_saved', items }        opt-in clients only (route decides)
//   { type: 'profile_undone', count }
//   { type: 'profile_confirm', facts }

const { Annotation, StateGraph, START, END } = require('@langchain/langgraph');
const { checkMessage, safetyReply, exerciseCautionLine } = require('../safety/safetyRules');
const { detectInjection, scopeReply } = require('../safety/scopeGuard');
const { classify, keywordFallback } = require('./intentClassifier');
const { pickGapQuestion } = require('./gapEngine');
const { pickCheckIn, isRelated, inQuestionCooldown, LAST_ASK_KEY } = require('./checkIns');
const { runSpecialists } = require('../specialists');
const { buildRequest, streamAnswer } = require('../response/responseGenerator');
const { triageFacts, isYes, isNo, isUndo, describeFact, specifyQuestion, specifyQuestionAlt, SPECIFIC_TARGETS, UNDO_WINDOW_MS, CONFIRM_WINDOW_MS } = require('../tools/profileTools');
const { parseSymptomReply } = require('../tools/symptomTools');
const { applyRoutingRules, mergeRouting } = require('./routingRules');
const { parseLookbackDays, mergeLookback, LONG_RANGE_DAYS } = require('../context/lookback');

const PENDING_QUESTION_TTL_MS = 24 * 60 * 60 * 1000;

const last = () => Annotation();
const State = Annotation.Root({
    userId: last(),
    userName: last(),
    message: last(),
    history: last(),
    now: last(),

    coachState: last(),       // loaded memory
    nextCoachState: last(),   // memory to save
    profileContext: last(),
    classification: last(),
    safety: last(),
    action: last(),           // 'undo' | 'confirm_yes' | 'confirm_no' | null

    savedFacts: last(),
    confirmFacts: last(),
    undoneCount: last(),
    gapQuestion: last(),
    specialistResults: last(),
    prefetched: last(),       // { lookbackDays, results } fetched while the classifier ran
    targets: last(),          // app targets + today's remaining (context/targets.js)
    freshness: last(),        // how old weight / sugar / report are, vault files (context/freshness.js)
    activeSymptoms: last(),   // open SymptomLog episodes
    symptomChanges: last(),   // what this message changed in them
    checkIn: last(),          // the one question added to this reply (orchestrator/checkIns.js)
    mealOffer: last(),        // offer "add this meal pattern to your 7-day plan?" at the end
    savedMealPatterns: last(),
    foodToConfirm: last(),    // "I ate X": estimated entry shown for "save?"
    specify: last(),          // "yes" without what to a profile question: ask "what exactly?" once
    droppedRequest: last(),   // a paused request the user moved on from: the answer must not cover it
    loggedFood: last(),       // entry saved this turn after "yes"

    reply: last(),
    route: last(),
    dataBlock: last(),        // the per-message data the model saw (debug / staging runs)
    startedAt: last(),        // ms timestamp when the request started (for timings)
    usage: Annotation({ reducer: (a, b) => a.concat(b || []), default: () => [] }),
    timings: Annotation({ reducer: (a, b) => ({ ...a, ...(b || {}) }), default: () => ({}) }),
});

const deps = (config) => config.configurable.deps;
const write = (config, event) => { if (config.writer) config.writer(event); };
// True if `date` is less than `ms` old. A date more than 5 min in the future is
// NOT within (only server clock skew is tolerated): a time-shifted test run or
// a bad clock must not keep a pending question alive for days.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const within = (date, ms, now) => {
    if (!date) return false;
    const age = now.getTime() - new Date(date).getTime();
    return age > -FUTURE_TOLERANCE_MS && age < ms;
};
const wordCount = (m) => String(m || '').trim().split(/\s+/).filter(Boolean).length;
const SHORT_REPLY_WORDS = 6; // "thoda better hai ab" is an answer; "I'm tired, should I go to the gym?" is not

// ── nodes ──────────────────────────────────────────────────────────────────

// "I ate / had / khaya ...": a meal to log (needs the classifier + estimator first).
const FOOD_EATEN_RE = /\b(khaya|khayi|khaye|khaa liya|kha liya|kha li|kha chuka|kha chuki|piya|pi li|pee li|ate|eaten|i had|i've had|had (a |an |some |my )?(breakfast|lunch|dinner|snack)|drank)\b/i;
// A health fact the user states about themselves ("I take metformin", "mujhe
// allergy hai", "I weigh 70"): the classifier must see it BEFORE the answer so
// the reply can ask "save it?" (fast path would lose it under another question).
const FACT_HINT_RE = /\b(i take|i'm taking|i am taking|le raha|le rahi|leta hoon|leti hoon|tablet|medicine|dawai|dawa|allerg\w*|diagnosed|i have (diabetes|bp|thyroid|asthma|pcos|cholesterol)|mujhe (diabetes|bp|sugar|thyroid|asthma|pcos)|i'?m (diabetic|vegetarian|vegan|pregnant)|i (smoke|drink)|smoking|cigarette|sharab|alcohol|surgery|operation|injur\w*|my weight|i weigh|weight (is|hai)|kg (hai|hoon|hun|now))\b/i;
// Symptoms that change food / exercise advice and the plan offer (stomach,
// pain, fever...): the classifier records them first. Tiredness stays on the
// fast path (recorded right after the answer).
const SYMPTOM_HINT_RE = /\b(stomach|acidity|acid reflux|heartburn|gas|bloat\w*|nausea|vomit\w*|diarrh\w*|loose motion|constipat\w*|indigestion|pait|pet dard|jalan|ulti|dast|kabz|pain|ache|dard|sore throat|fever|bukhar|cold|cough|khansi|zukam|dizz\w*|chakkar|headache|migraine|injur\w*|sprain|swelling|sujan)\b/i;
// "what should I eat", "meal do", "supplement lu?": the answer would recommend food.
const RECOMMEND_RE = /\b(what (should|can|to) (i )?eat|suggest|recommend|meal (generate|plan|do|bana\w*|chahiye)|diet plan|plan (do|bana\w*)|kya khaun|kya khau|kya khana chahiye|kya khaana|supplements?|vitamins?|should i take|kaun sa khana)\b/i;
const { detectLanguage, resolveLanguage } = require('./language');

// The rule-based stand-in used on the fast path until the classifier's
// answer arrives (applied in `reconcile`).
function provisionalClassification(message, ruled, lookbackDays) {
    const base = keywordFallback(message, 'fast_path');
    return {
        ...base,
        intent: 'health_coaching',
        topics: ruled.topics.length ? ruled.topics : ['general'],
        specialists: ruled.specialists,
        lookbackDays,
        language: detectLanguage(message), // may be 'neutral': resolved in prepare
        recommendsFoodOrSupplement: RECOMMEND_RE.test(message),
        source: 'rules',
        provisional: true,
    };
}

function mergeUpdates(a = [], b = []) {
    const seen = new Set();
    return [...a, ...b].filter((u) => { const k = String(u.name).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

// Per-run scratch space (promises can't live in graph state).
const runCtx = (config) => config.configurable.runCtx;

async function prepare(state, config) {
    const d = deps(config);
    const now = state.now || new Date();
    const startedAt = state.startedAt || Date.now();
    const timings = {};
    const timed = async (name, promise) => {
        const t0 = Date.now();
        try { return await promise; } finally { timings[name] = Date.now() - t0; }
    };

    // Reads that don't depend on coach memory start NOW, together with it
    // (staging 24 Nov: loading memory first, then these, cost ~0.9 s on the
    // first message). Skipped for emergencies, injections and short
    // "yes / no / undo" replies (those are usually actions that need none of it).
    const safety = checkMessage(state.message);
    const injection = !safety.flagged && detectInjection(state.message);
    const ruled = applyRoutingRules(state.message);
    const parsedLookback = parseLookbackDays(state.message, now);
    const shortReply = wordCount(state.message) <= 4
        && (isYes(state.message) || isNo(state.message) || isUndo(state.message));
    const early = !safety.flagged && !injection && !shortReply;
    const startProfile = () => timed('profileMs', d.getProfileContext(state.userId).catch(() => null));
    const startPrefetch = () => (ruled.specialists.length
        ? timed('prefetchMs', runSpecialists(ruled.specialists, {
            userId: state.userId, now, lookbackDays: parsedLookback, deps: d.specialistDeps || {}, logger: d.logger,
        }).catch(() => []))
        : Promise.resolve([]));
    const startTargets = () => timed('targetsMs', (d.getTargets ? d.getTargets(state.userId, { now }) : Promise.resolve(null)).catch(() => null));
    const startFreshness = () => (d.getFreshness ? timed('freshnessMs', d.getFreshness(state.userId, { now }).catch(() => null)) : Promise.resolve(null));
    const profileCall = startProfile();
    const earlyCalls = early ? { prefetch: startPrefetch(), targets: startTargets(), freshness: startFreshness() } : null;

    // Coach memory + open symptom episodes (the classifier needs both).
    const [coachState, activeSymptoms] = await Promise.all([
        d.coachStateRepo.load(state.userId),
        d.symptomTools ? d.symptomTools.listActive(state.userId).catch(() => []) : Promise.resolve([]),
    ]);

    // What the message means given the last turn, before any model call.
    let action = null;
    if (coachState.lastSaved && within(coachState.lastSaved.savedAt, UNDO_WINDOW_MS, now) && isUndo(state.message)) action = 'undo';
    else if (coachState.pendingConfirm && within(coachState.pendingConfirm.askedAt, CONFIRM_WINDOW_MS, now)) {
        if (isYes(state.message)) action = 'confirm_yes';
        else if (isNo(state.message)) action = 'confirm_no';
    } else if (coachState.pendingFoodLog && within(coachState.pendingFoodLog.askedAt, CONFIRM_WINDOW_MS, now)) {
        if (isYes(state.message)) action = 'food_log_yes';
        else if (isNo(state.message)) action = 'food_log_no';
    } else if (coachState.pendingMealPref && within(coachState.pendingMealPref.askedAt, CONFIRM_WINDOW_MS, now)) {
        if (isYes(state.message)) action = 'meal_pref_yes';
        else if (isNo(state.message)) action = 'meal_pref_no';
    }

    const pendingQuestion = coachState.pendingQuestion && within(coachState.pendingQuestion.askedAt, PENDING_QUESTION_TTL_MS, now)
        ? coachState.pendingQuestion : null;

    // Red-flag rules first (checked above): no model call needed to decide on
    // an emergency reply. Prompt injection: also decided without a model call.
    const usage = [];
    const skipModel = safety.flagged || injection || action;
    const loggingFood = FOOD_EATEN_RE.test(state.message);
    // Short replies about an open symptom ("ab thik hai"), read by code.
    const replyUpdates = parseSymptomReply(state.message, activeSymptoms);
    // A request paused by a blocking symptom question resumes only if this
    // message is the answer. A new request of its own (a topic the rules know,
    // more than a short reply, no symptom update) wins and the paused one is
    // dropped (staging 24 Nov: "tired, gym?" got the paused dinner plan).
    // Blocking profile questions (pendingQuestion) keep the classifier deciding.
    const pausedRaw = coachState.pendingRequest && within(coachState.pendingRequest.askedAt, PENDING_QUESTION_TTL_MS, now)
        ? coachState.pendingRequest : null;
    const newRequest = Boolean(pausedRaw) && !pendingQuestion && !replyUpdates.length
        && ruled.specialists.length > 0 && wordCount(state.message) > SHORT_REPLY_WORDS;
    const paused = newRequest ? null : pausedRaw;
    if (newRequest) timings.droppedPausedRequest = true;

    // FAST PATH (speed step, approved 24 Nov): when the rules already know the
    // topic, start the answer without waiting for the classifier (1.7-4.2 s on
    // staging; Sonnet's first token ~0.8 s). The classifier keeps running and
    // its results are applied after the answer (node `reconcile`). Not used when
    // the classifier must decide first: no topic matched (could be off-topic),
    // a meal to log, the answer to a pending question, or a paused request.
    const fast = !skipModel && ruled.specialists.length > 0 && !loggingFood && !pendingQuestion && !paused
        && !FACT_HINT_RE.test(state.message) && !SYMPTOM_HINT_RE.test(state.message);

    const classifyCall = skipModel
        ? Promise.resolve(keywordFallback(state.message, safety.flagged ? 'red_flag' : injection ? 'injection' : 'action'))
        : timed('classifyMs', classify({
            message: state.message,
            history: state.history,
            pendingQuestion,
            activeSymptoms: activeSymptoms.map((s) => s.name),
            client: d.client,
            onUsage: (u, model) => usage.push({ feature: 'ai_coach_classify', model, usage: u }),
        }));
    if (fast) runCtx(config).classify = { promise: classifyCall, usage };

    // A meal to log: start the app's estimator now, in parallel with the
    // classifier, instead of after it.
    if (loggingFood && !skipModel && d.foodLogTools?.estimate) {
        runCtx(config).estimate = timed('estimateMs', d.foodLogTools.estimate(state.message, state.userId).catch(() => null));
    }

    // Prefetch: the keyword rules already say which data this message needs,
    // so read it WHILE the classifier runs (DB reads ~100-500 ms, the model call
    // is the slow part). Whatever the classifier adds later is fetched after.
    // Started early above unless this looked like a short yes/no reply.
    const none = Promise.resolve(null);
    const [profileContext, rawClassification, prefetchedResults, targets, freshness] = await Promise.all([
        profileCall,
        fast ? Promise.resolve(provisionalClassification(state.message, ruled, parsedLookback)) : classifyCall,
        skipModel ? Promise.resolve([]) : (earlyCalls?.prefetch || startPrefetch()),
        skipModel ? none : (earlyCalls?.targets || startTargets()),
        skipModel ? none : (earlyCalls?.freshness || startFreshness()),
    ]);

    // Rules are a safety net on top of the model (union, never removal).
    const merged = skipModel ? rawClassification : mergeRouting(rawClassification, state.message);
    let classification = {
        ...merged,
        lookbackDays: mergeLookback(merged.lookbackDays, state.message, now),
        symptomUpdates: mergeUpdates(merged.symptomUpdates, replyUpdates),
    };
    timings.path = skipModel ? 'no_model' : fast ? 'fast' : 'full';

    // A request paused last turn by a blocking question ("meal do" -> "pait
    // kaisa hai?"): this message is the answer, so carry the original request's
    // routing forward and answer it now.
    if (paused && !skipModel && !['off_topic', 'greeting', 'thanks'].includes(classification.intent)) {
        const fromRules = applyRoutingRules(paused.message);
        classification = {
            ...classification,
            intent: ['other', 'profile_update', 'small_talk'].includes(classification.intent) ? 'health_coaching' : classification.intent,
            topics: [...new Set([...(classification.topics || []).filter((t) => t !== 'general'), ...(paused.topics || []), ...fromRules.topics])],
            specialists: [...new Set([...(classification.specialists || []), ...(paused.specialists || []), ...fromRules.specialists])],
            recommendsFoodOrSupplement: classification.recommendsFoodOrSupplement || Boolean(paused.recommendsFoodOrSupplement),
            resumeRequest: paused.message,
        };
    }

    // ONE language for this message, used by every node (fixed lines, gap
    // questions, the answer). Short neutral messages keep the chat's language.
    const language = resolveLanguage({
        message: state.message,
        classifierLanguage: classification.source === 'model' ? classification.language : null,
        previous: coachState.lastLanguage,
    });
    classification = { ...classification, language };

    return {
        now,
        startedAt,
        coachState: { ...coachState, pendingQuestion, lastLanguage: language },
        profileContext,
        classification,
        safety: { ...safety, injection },
        action,
        // Fast path: the classifier's usage is returned by `reconcile` (once).
        usage: fast ? [] : usage,
        targets,
        freshness,
        activeSymptoms,
        // Still in the chat history the app sends, so the answer model would
        // answer it too (staging 24 Nov) unless told it was dropped.
        droppedRequest: newRequest ? String(pausedRaw.message).slice(0, 300) : null,
        prefetched: { lookbackDays: parsedLookback, results: prefetchedResults },
        timings: { ...timings, prepareMs: Date.now() - startedAt },
    };
}

// Node names must differ from state keys (LangGraph channels).
const N = {
    prepare: 'prepare',
    safety: 'safety_reply',
    scope: 'scope_reply',
    quick: 'quick_reply',
    actions: 'profile_actions',
    gap: 'gap_check',
    specialists: 'run_specialists',
    respond: 'respond',
    reconcile: 'reconcile',
    logged: 'action_reply', // fixed reply after "yes" to a meal or "undo"
    persist: 'persist',
};

function routeAfterPrepare(state) {
    // An exercise caution (code rules already checked for severe signs) is not
    // turned back into an emergency by the classifier: product decision 24 Nov.
    if (state.safety.flagged || (state.classification.redFlag && !state.safety.caution)) return N.safety;
    if (state.safety.injection) return N.scope;
    if (!state.action && state.classification.intent === 'off_topic' && !state.classification.facts?.length) return N.scope;
    if (!state.action && ['greeting', 'thanks'].includes(state.classification.intent)) return N.quick;
    return N.actions;
}

async function safetyNode(state, config) {
    const kind = state.safety.flagged ? state.safety.kind : 'emergency';
    const reply = safetyReply(kind, { language: state.classification.language });
    write(config, { type: 'token', text: reply });
    // No profile questions or saves during an emergency.
    return {
        reply, route: 'safety',
        nextCoachState: { ...state.coachState, pendingQuestion: null, pendingConfirm: null },
        timings: { firstTokenMs: Date.now() - state.startedAt },
    };
}

// Off-topic or prompt injection: fixed friendly reply, no answer-model call.
async function scopeNode(state, config) {
    const firstName = String(state.userName || '').trim().split(/\s+/)[0];
    const reply = scopeReply(state.safety.injection ? 'injection' : 'off_topic', { language: state.classification.language, firstName });
    write(config, { type: 'token', text: reply });
    return { reply, route: state.safety.injection ? 'injection' : 'off_topic', nextCoachState: { ...state.coachState }, timings: { firstTokenMs: Date.now() - state.startedAt } };
}

async function quickNode(state, config) {
    const first = String(state.userName || '').trim().split(/\s+/)[0];
    const hinglish = ['hinglish', 'hindi'].includes(state.classification.language);
    const reply = state.classification.intent === 'thanks'
        ? (hinglish ? 'Koi baat nahi! Aur kuch poochna ho to bataiye.' : 'You\'re welcome! Let me know if there\'s anything else.')
        : `Hi${first ? ` ${first}` : ''}! ${hinglish ? 'Aaj kis cheez mein madad karun?' : 'How can I help you today?'}`;
    write(config, { type: 'token', text: reply });
    return { reply, route: 'quick', nextCoachState: { ...state.coachState }, timings: { firstTokenMs: Date.now() - state.startedAt } };
}

// Undo / confirm handling + saving facts from this message.
async function actionsNode(state, config) {
    const d = deps(config);
    const cs = state.coachState;
    let savedFacts = [];
    let undoneCount = 0;
    const next = { ...cs, pendingConfirm: null };

    if (state.action === 'undo') {
        undoneCount = await d.profileTools.undoSaved(state.userId, cs.lastSaved.items);
        next.lastSaved = null;
        write(config, { type: 'profile_undone', count: undoneCount });
    } else if (state.action === 'confirm_yes') {
        savedFacts = await d.profileTools.saveFacts(state.userId, cs.pendingConfirm.facts);
    }

    // "Add this meal to my plan" -> yes: save the meal patterns from that reply.
    // Food: "yes" saves the meal shown last turn (through the app's meal log
    // path); a new "I ate X" is estimated and shown for confirmation.
    let loggedFood = null;
    let foodToConfirm = null;
    let targets = state.targets;
    next.pendingFoodLog = null;
    if (state.action === 'food_log_yes' && d.foodLogTools) {
        try {
            await d.foodLogTools.save(state.userId, cs.pendingFoodLog.entry, state.now);
            loggedFood = cs.pendingFoodLog.entry;
            write(config, { type: 'food_logged', mealType: loggedFood.mealType, nutrition: loggedFood.nutrition });
            // "Left for today" must include the meal just saved.
            if (d.getTargets) targets = await d.getTargets(state.userId, { now: state.now }).catch(() => targets);
        } catch (err) {
            d.logger.error(`[AICoach] food log not saved: ${err.message}`);
            loggedFood = { failed: true };
        }
    } else if (!state.action && d.foodLogTools && state.classification.mealLog?.isLogging) {
        foodToConfirm = await d.foodLogTools.prepare(state.userId, state.classification.mealLog, state.now, { prefetched: runCtx(config).estimate })
            .catch((err) => { d.logger.warn(`[AICoach] food log not prepared: ${err.message}`); return null; });
        if (foodToConfirm) {
            next.pendingFoodLog = { entry: foodToConfirm, askedAt: state.now };
            write(config, { type: 'food_log_confirm', entry: foodToConfirm });
        }
    }

    let savedMealPatterns = null;
    const usageNow = []; // returned through the `usage` reducer, never by mutating state
    next.pendingMealPref = null;
    if (state.action === 'meal_pref_yes' && d.mealPrefTools) {
        savedMealPatterns = await d.mealPrefTools.savePatternsFromReply(state.userId, {
            client: d.client,
            replyText: cs.pendingMealPref.replyText,
            onUsage: (u, model) => usageNow.push({ feature: 'ai_coach_classify', model, usage: u }),
        });
        if (savedMealPatterns.length) write(config, { type: 'meal_pref_saved', patterns: savedMealPatterns });
    }

    // Facts in this message (none when it was only "yes" / "no" / "undo").
    const { saveNow, confirm, vague } = state.action ? { saveNow: [], confirm: [], vague: [] } : triageFacts(state.classification.facts, cs.pendingQuestion);

    // "haan" / "yes, an injury" to "any injury?" says nothing usable: save
    // nothing and ask once what exactly. A second vague answer is let go.
    const pq = cs.pendingQuestion;
    let specify = null;
    if (!state.action && pq && !pq.followUp && SPECIFIC_TARGETS.includes(pq.field)
        && !saveNow.some((f) => f.target === pq.field)
        && (vague.some((f) => f.target === pq.field) || isYes(state.message))) {
        const hi = ['hinglish', 'hindi'].includes(state.classification.language);
        const question = specifyQuestion(pq.field, hi);
        if (question) specify = { field: pq.field, question, questionAlt: specifyQuestionAlt(pq.field, hi), blocking: false, followUp: true };
    }
    if (saveNow.length) savedFacts = savedFacts.concat(await d.profileTools.saveFacts(state.userId, saveNow));
    if (savedFacts.length) {
        next.lastSaved = { items: savedFacts, savedAt: state.now };
        write(config, { type: 'profile_saved', items: savedFacts.map(({ target, value, none, historyId }) => ({ target, value, none, historyId })) });
    }
    if (confirm.length) {
        next.pendingConfirm = { facts: confirm, askedAt: state.now };
        write(config, { type: 'profile_confirm', facts: confirm.map(({ target, value, none }) => ({ target, value, none })) });
    }
    // The pending question has had its one chance to be answered, and a paused
    // request is answered in this turn.
    next.pendingQuestion = null;
    next.pendingRequest = null;

    // Symptoms: new ones open an episode; "theek ho gaya" closes one (only the
    // user closes an episode). Never on undo / yes / no messages.
    let symptomChanges = [];
    let activeSymptoms = state.activeSymptoms || [];
    const sym = state.classification;
    if (!state.action && d.symptomTools && (sym.symptoms?.length || sym.symptomUpdates?.length)) {
        symptomChanges = await d.symptomTools.record(state.userId, { symptoms: sym.symptoms || [], updates: sym.symptomUpdates || [] }, state.now);
        if (symptomChanges.length) activeSymptoms = await d.symptomTools.listActive(state.userId).catch(() => activeSymptoms);
    }

    // Saved facts change the profile the answer should use.
    const profileContext = savedFacts.length || undoneCount
        ? await d.getProfileContext(state.userId, { fresh: true }).catch(() => state.profileContext)
        : state.profileContext;

    return {
        savedFacts, confirmFacts: confirm, undoneCount, nextCoachState: next, profileContext, symptomChanges, activeSymptoms,
        savedMealPatterns, loggedFood, foodToConfirm, targets, usage: usageNow, specify,
    };
}

// The ONE question for this reply: missing profile fact, symptom follow-up,
// stale weight / sugar, vault file, old report (orchestrator/checkIns.js).
async function gapNode(state, config) {
    // Don't stack a question on undo / yes / no, or on top of "save this?" / "log this meal?".
    if (state.action || state.confirmFacts?.length || state.foodToConfirm) return { gapQuestion: null, checkIn: null, mealOffer: false };
    // The user said "yes" without what: this turn's one question is "what exactly?".
    if (state.specify) {
        const s = state.specify;
        return { gapQuestion: s, checkIn: { kind: 'gap', key: s.field, blocking: false, question: s.question, instruction: null, followUp: true }, mealOffer: false };
    }
    const resuming = Boolean(state.classification.resumeRequest);
    let gapQuestion = pickGapQuestion(state.classification, state.profileContext, state.nextCoachState.askedLog, state.now);
    // Resuming a paused request: never block a second time (that would loop
    // if the user skipped the question); ask at the end instead.
    if (resuming && gapQuestion?.blocking) gapQuestion = { ...gapQuestion, blocking: false };
    let checkIn = pickCheckIn({
        resuming,
        classification: state.classification,
        gapQuestion,
        symptoms: state.activeSymptoms || [],
        symptomUpdates: state.classification.symptomUpdates || [],
        freshness: state.freshness,
        profileContext: state.profileContext,
        targets: state.targets,
        askedLog: state.nextCoachState.askedLog,
        now: state.now,
    });
    // Exercise caution turn (breathless / chest after the gym): no extra
    // question; the reply ends with the fixed "when to call 112" line
    // (staging 25 Nov: an injury question landed before that line). On the
    // fast path the classifier's symptom list isn't known yet, so the caution
    // flag is what marks this as an "unwell" turn.
    const caution = Boolean(state.safety && state.safety.caution);
    if (caution && checkIn && !checkIn.blocking) checkIn = null;

    // Meal suggestions -> offer to add the pattern to the 7-day plan. Not while
    // a stomach-type symptom is active (temporary gentle food must not become
    // a favourite), and not on top of a blocking question.
    const c = state.classification;
    const stomachIssue = (state.activeSymptoms || []).some((s) => isRelated(s, ['nutrition']));
    const mealOffer = Boolean(deps(config).mealPrefTools) && c.recommendsFoodOrSupplement && (c.topics || []).includes('nutrition')
        && !inQuestionCooldown(state.nextCoachState.askedLog, state.now)
        && !stomachIssue && !caution && !checkIn?.blocking;
    // One question per reply: the plan offer replaces a non-blocking check-in.
    const finalCheckIn = mealOffer && checkIn && !checkIn.blocking ? null : checkIn;
    return { gapQuestion: finalCheckIn?.kind === 'gap' ? gapQuestion : null, checkIn: finalCheckIn, mealOffer };
}

// "yes" to a meal shown last turn: it is saved in `actions`; the reply is a
// fixed line (no answer-model call: staging 24 Nov this took ~2.7 s for one
// sentence). Same for "undo".
function routeAfterActions(state) {
    return state.action === 'food_log_yes' || state.action === 'undo' ? N.logged : N.gap;
}

// "undo": say what was removed in one fixed line (staging 24 Nov: a Sonnet
// call took 2.1 s for this).
function undoText(items = [], count = 0, hinglish = false) {
    if (!count) {
        return hinglish
            ? 'Hatane ke liye kuch nahi mila, shayad pehle hi hat chuka hai. Profile screen pe check kar sakte ho.'
            : 'There was nothing left to remove; it may already be gone. You can check on the Profile screen.';
    }
    const what = items.map((f) => describeFact(f, hinglish)).filter(Boolean).join('; ');
    return hinglish
        ? `Theek hai, hata diya${what ? `: ${what}` : ''}. Profile pehle jaisi ho gayi hai.`
        : `Done, removed${what ? `: ${what}` : ''}. Your profile is back to how it was.`;
}

// How a streamed answer ends: null = no question, 'save' = it already asks to
// save something to the profile, 'other' = some other question.
const SAVE_QUESTION_RE = /\b(save|profile|update|note|record)\b|\bsave kar|\bprofile mein/i;
function endingQuestion(reply = '') {
    const lines = String(reply).trim().split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1] || '';
    if (!last.includes('?')) return null;
    return SAVE_QUESTION_RE.test(last) ? 'save' : 'other';
}

// Fixed "save this?" line. Hinglish has no tu / aap word, so it fits either
// form the answer used (staging 25 Nov: "tumne bataya" after a "tu" reply).
function confirmText(facts, hinglish) {
    const what = facts.map((f) => describeFact(f, hinglish)).join('; ');
    return hinglish
        ? `\n\nEk baat: ${what}. Ye profile mein save kar doon? (haan / nahi)`
        : `\n\nBy the way, you mentioned ${what}. Should I save this to your profile? (yes / no)`;
}

function foodLoggedText(loggedFood, targets, hinglish) {
    if (!loggedFood || loggedFood.failed) {
        return hinglish
            ? 'Sorry, abhi meal save nahi ho paaya. Thodi der baad dobara bolo, ya Nutrition screen se add kar lo.'
            : 'Sorry, I couldn\'t save that meal right now. Please try again in a bit, or add it from the Nutrition screen.';
    }
    const n = loggedFood.nutrition || {};
    const meal = loggedFood.mealType && loggedFood.mealType !== 'other' ? loggedFood.mealType : 'meal';
    const saved = `${n.calories} kcal${n.protein != null ? `, ${n.protein} g protein` : ''}`;
    const r = targets?.remaining || {};
    const left = [
        r.calories != null && `${r.calories} kcal`,
        r.protein != null && `${r.protein} g protein`,
        r.waterMl != null && `${r.waterMl} ml ${hinglish ? 'paani' : 'water'}`,
    ].filter(Boolean);
    const leftText = left.length ? (hinglish ? ` Aaj ke liye ab ${left.join(', ')} bacha hai.` : ` Left for today: ${left.join(', ')}.`) : '';
    return hinglish
        ? `Ho gaya, ${meal} log mein save kar diya: ${saved}.${leftText}`
        : `Done, saved to your ${meal} log: ${saved}.${leftText}`;
}

// Fixed replies, no answer-model call: "yes" to a meal, "undo".
async function actionReplyNode(state, config) {
    // Language resolved once in prepare (short "yes" / "undo" keep the chat's language).
    const hinglish = ['hinglish', 'hindi'].includes(state.classification.language);
    const reply = state.action === 'undo'
        ? undoText(state.coachState?.lastSaved?.items || [], state.undoneCount || 0, hinglish)
        : foodLoggedText(state.loggedFood, state.targets, hinglish);
    write(config, { type: 'token', text: reply });
    return { reply, route: 'coach', timings: { firstTokenMs: Date.now() - state.startedAt } };
}

function routeAfterGap(state) {
    const needs = state.classification.specialists?.length > 0 && !state.checkIn?.blocking && !state.action;
    return needs ? N.specialists : N.respond;
}

// Uses the prefetched results when they were read for the same window; runs
// only what the classifier added (or what needs a longer window).
async function specialistsNode(state, config) {
    const d = deps(config);
    const wanted = state.classification.specialists;
    const lookbackDays = state.classification.lookbackDays || 0;
    // Prefetch is reusable if both are "recent window", or both the same long window.
    const prefetchDays = state.prefetched?.lookbackDays || 0;
    const sameWindow = lookbackDays > LONG_RANGE_DAYS ? prefetchDays === lookbackDays : prefetchDays <= LONG_RANGE_DAYS;
    const reuse = sameWindow ? (state.prefetched?.results || []).filter((r) => wanted.includes(r.specialist)) : [];
    const missing = wanted.filter((s) => !reuse.some((r) => r.specialist === s));
    const t0 = Date.now();
    const fresh = missing.length
        ? await runSpecialists(missing, { userId: state.userId, now: state.now, lookbackDays, deps: d.specialistDeps || {}, logger: d.logger })
        : [];
    const byName = new Map([...reuse, ...fresh].map((r) => [r.specialist, r]));
    return {
        specialistResults: wanted.map((s) => byName.get(s)).filter(Boolean),
        timings: { extraSpecialistsMs: Date.now() - t0, specialistsReused: reuse.length, specialistsFetchedAfter: missing.length },
    };
}

async function respondNode(state, config) {
    const d = deps(config);
    const request = buildRequest({
        message: state.message,
        history: state.history,
        userName: state.userName,
        profileContext: state.profileContext,
        classification: state.classification,
        specialistResults: state.specialistResults || [],
        gapQuestion: state.gapQuestion,
        confirmFacts: state.confirmFacts || [],
        savedFacts: state.savedFacts || [],
        undoneCount: state.undoneCount || 0,
        targets: state.targets,
        checkInInstruction: state.checkIn && state.checkIn.kind !== 'gap' ? state.checkIn.instruction : null,
        activeSymptoms: state.activeSymptoms || [],
        symptomChanges: state.symptomChanges || [],
        mealOffer: Boolean(state.mealOffer),
        savedMealPatterns: state.savedMealPatterns || null,
        mealPrefDeclined: state.action === 'meal_pref_no',
        foodToConfirm: state.foodToConfirm || null,
        loggedFood: state.loggedFood || null,
        foodLogDeclined: state.action === 'food_log_no',
        exerciseCaution: Boolean(state.safety && state.safety.caution),
        droppedRequest: state.droppedRequest || null,
    });
    const t0 = Date.now();
    let firstTokenAt = null;
    const out = await streamAnswer({
        client: d.client,
        request,
        signal: d.signal,
        onToken: (text) => {
            if (firstTokenAt === null) firstTokenAt = Date.now();
            write(config, { type: 'token', text });
        },
    });
    // Fixed text, not model text: the "when to call 112" line must always be there.
    if (state.safety && state.safety.caution) {
        const line = `\n\n${exerciseCautionLine({ language: state.classification.language })}`;
        write(config, { type: 'token', text: line });
        out.text += line;
    }

    // Remember what was asked: snooze it, and read the next message as its answer.
    const next = { ...state.nextCoachState };
    if (state.mealOffer) next.pendingMealPref = { replyText: out.text.slice(0, 4000), askedAt: state.now };
    const ci = state.checkIn;
    // Any non-blocking question starts the 30-min question cooldown (issue #6).
    if (state.mealOffer || (ci && !ci.blocking)) next.askedLog = { ...(next.askedLog || {}), [LAST_ASK_KEY]: state.now };
    if (ci) {
        next.askedLog = { ...(next.askedLog || {}), [ci.key]: state.now };
        if (ci.kind === 'gap') next.pendingQuestion = { field: ci.key, question: ci.question, askedAt: state.now, ...(ci.followUp ? { followUp: true } : {}) };
        if (ci.kind === 'weight') next.pendingQuestion = { field: 'body.weightKg', question: ci.question?.en || 'What is your weight now?', askedAt: state.now };
        if (ci.blocking) {
            next.pendingRequest = {
                message: String(state.message).slice(0, 2000),
                topics: state.classification.topics || [],
                specialists: state.classification.specialists || [],
                recommendsFoodOrSupplement: Boolean(state.classification.recommendsFoodOrSupplement),
                askedAt: state.now,
            };
        }
        if (ci.kind === 'symptom' && ci.symptomId && d.symptomTools) {
            await d.symptomTools.markAsked(ci.symptomId, state.now).catch((e) => d.logger.warn(`[AICoach] symptom ask not recorded: ${e.message}`));
        }
    }
    return {
        reply: out.text,
        route: 'coach',
        nextCoachState: next,
        dataBlock: request.messages[request.messages.length - 1].content,
        usage: [{ feature: 'ai_coach_v2', model: out.model, usage: out.usage, stopReason: out.stopReason }],
        timings: {
            answerFirstTokenMs: firstTokenAt === null ? null : firstTokenAt - t0, // model latency alone
            firstTokenMs: firstTokenAt === null ? null : firstTokenAt - state.startedAt, // what the user waits
            answerTotalMs: Date.now() - t0,
        },
    };
}

// Fast path only: the answer has streamed; now apply what the classifier found
// (it ran in parallel). Anything that needs the user is appended to the same
// reply, before [DONE]:
//   - a red flag the code rules missed -> safety message (rules ran first anyway)
//   - symptoms / symptom updates -> SymptomLog
//   - health facts the user volunteered -> "save to your profile?" (only if the
//     reply asked nothing else: one question per reply)
async function reconcileNode(state, config) {
    const pending = runCtx(config).classify;
    if (!pending) return {};
    const d = deps(config);
    const t0 = Date.now();
    let full;
    try {
        full = await pending.promise;
    } catch {
        return {};
    }
    const waited = Date.now() - t0;
    // Same resolution as prepare, now with the classifier's view; the answer
    // already streamed in state.classification.language, so neutral keeps it.
    const lang = resolveLanguage({ message: state.message, classifierLanguage: full.language, previous: state.classification.language });
    full = { ...full, language: lang };
    const next = { ...state.nextCoachState };
    let appended = '';
    const say = (text) => { appended += text; write(config, { type: 'token', text }); };

    if (full.redFlag && !state.safety.flagged && !state.safety.caution) say(`\n\n${safetyReply('emergency', { language: full.language })}`);

    let symptomChanges = state.symptomChanges || [];
    const done = new Set((state.classification.symptomUpdates || []).map((u) => String(u.name).toLowerCase()));
    const updates = (full.symptomUpdates || []).filter((u) => !done.has(String(u.name).toLowerCase()));
    if (d.symptomTools && (full.symptoms?.length || updates.length)) {
        symptomChanges = symptomChanges.concat(await d.symptomTools.record(state.userId, { symptoms: full.symptoms || [], updates }, state.now));
    }

    const askedSomething = state.checkIn || state.mealOffer || state.foodToConfirm || state.confirmFacts?.length || full.redFlag;
    if (!askedSomething) {
        const { confirm } = triageFacts(full.facts, null);
        // One question per reply (staging 25 Nov: the answer already asked
        // "update your weight to 70 kg?" and the fixed line asked it again).
        const ending = endingQuestion(state.reply);
        if (confirm.length && ending !== 'other') {
            next.pendingConfirm = { facts: confirm, askedAt: state.now };
            next.askedLog = { ...(next.askedLog || {}), [LAST_ASK_KEY]: state.now }; // counts as a question (issue #6)
            write(config, { type: 'profile_confirm', facts: confirm.map(({ target, value, none }) => ({ target, value, none })) });
            if (!ending) {
                // Same language as the answer that already streamed.
                const replyHi = ['hinglish', 'hindi'].includes(state.classification.language);
                say(confirmText(confirm, replyHi));
            }
        }
    }

    return {
        usage: pending.usage.slice(),
        reply: state.reply + appended,
        nextCoachState: next,
        symptomChanges,
        classification: { ...mergeRouting(full, state.message), provisional: false, answeredOnFastPath: true },
        timings: { classifierWaitAfterAnswerMs: waited },
    };
}

async function persistNode(state, config) {
    const d = deps(config);
    try {
        const toSave = { ...(state.nextCoachState || state.coachState || {}), lastChatAt: state.now || new Date() };
        await d.coachStateRepo.save(state.userId, toSave);
    } catch (err) {
        d.logger.error(`[AICoach] coach state not saved: ${err.message}`);
    }
    return {};
}

// ── graph ──────────────────────────────────────────────────────────────────

function buildCoachGraph() {
    return new StateGraph(State)
        .addNode(N.prepare, prepare)
        .addNode(N.safety, safetyNode)
        .addNode(N.scope, scopeNode)
        .addNode(N.quick, quickNode)
        .addNode(N.logged, actionReplyNode)
        .addNode(N.actions, actionsNode)
        .addNode(N.gap, gapNode)
        .addNode(N.specialists, specialistsNode)
        .addNode(N.respond, respondNode)
        .addNode(N.reconcile, reconcileNode)
        .addNode(N.persist, persistNode)
        .addEdge(START, N.prepare)
        .addConditionalEdges(N.prepare, routeAfterPrepare, [N.safety, N.scope, N.quick, N.actions])
        .addConditionalEdges(N.actions, routeAfterActions, [N.gap, N.logged])
        .addEdge(N.logged, N.persist)
        .addConditionalEdges(N.gap, routeAfterGap, [N.specialists, N.respond])
        .addEdge(N.specialists, N.respond)
        .addEdge(N.safety, N.persist)
        .addEdge(N.scope, N.persist)
        .addEdge(N.quick, N.persist)
        .addEdge(N.respond, N.reconcile)
        .addEdge(N.reconcile, N.persist)
        .addEdge(N.persist, END)
        .compile();
}

let compiled;
const getCoachGraph = () => (compiled ||= buildCoachGraph());

/**
 * Runs one message. onEvent(event) gets every custom-stream event in order.
 * Resolves with the final state (reply, route, usage, ...). Throws if the
 * answer model fails before streaming anything; the caller then falls back.
 */
async function runCoach({ input, deps: d, onEvent }) {
    const graph = getCoachGraph();
    let finalState = null;
    const stream = await graph.stream(input, { streamMode: ['custom', 'values'], configurable: { deps: d, runCtx: {} } });
    for await (const [mode, chunk] of stream) {
        if (mode === 'custom') onEvent(chunk);
        else finalState = chunk;
    }
    return finalState;
}

module.exports = { buildCoachGraph, getCoachGraph, runCoach, routeAfterPrepare, routeAfterGap, foodLoggedText, undoText, endingQuestion, confirmText };
