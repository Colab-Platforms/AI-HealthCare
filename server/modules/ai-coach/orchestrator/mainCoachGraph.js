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
const { checkMessage, safetyReply } = require('../safety/safetyRules');
const { classify, keywordFallback } = require('./intentClassifier');
const { pickGapQuestion } = require('./gapEngine');
const { runSpecialists } = require('../specialists');
const { buildRequest, streamAnswer } = require('../response/responseGenerator');
const { triageFacts, isYes, isNo, isUndo, UNDO_WINDOW_MS, CONFIRM_WINDOW_MS } = require('../tools/profileTools');

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

    reply: last(),
    route: last(),
    usage: Annotation({ reducer: (a, b) => a.concat(b || []), default: () => [] }),
});

const deps = (config) => config.configurable.deps;
const write = (config, event) => { if (config.writer) config.writer(event); };
const within = (date, ms, now) => date && now.getTime() - new Date(date).getTime() < ms;

// ── nodes ──────────────────────────────────────────────────────────────────

async function prepare(state, config) {
    const d = deps(config);
    const now = state.now || new Date();
    const coachState = await d.coachStateRepo.load(state.userId);

    // What the message means given the last turn, before any model call.
    let action = null;
    if (coachState.lastSaved && within(coachState.lastSaved.savedAt, UNDO_WINDOW_MS, now) && isUndo(state.message)) action = 'undo';
    else if (coachState.pendingConfirm && within(coachState.pendingConfirm.askedAt, CONFIRM_WINDOW_MS, now)) {
        if (isYes(state.message)) action = 'confirm_yes';
        else if (isNo(state.message)) action = 'confirm_no';
    }

    const pendingQuestion = coachState.pendingQuestion && within(coachState.pendingQuestion.askedAt, PENDING_QUESTION_TTL_MS, now)
        ? coachState.pendingQuestion : null;

    // Red-flag rules first: no model call needed to decide on an emergency reply.
    const safety = checkMessage(state.message);
    const usage = [];
    const classifyCall = (safety.flagged || action)
        ? Promise.resolve(keywordFallback(state.message, safety.flagged ? 'red_flag' : 'action'))
        : classify({
            message: state.message,
            history: state.history,
            pendingQuestion,
            client: d.client,
            onUsage: (u, model) => usage.push({ feature: 'ai_coach_classify', model, usage: u }),
        });

    // Profile and classification in parallel: the two slow-ish reads.
    const [profileContext, classification] = await Promise.all([
        d.getProfileContext(state.userId).catch(() => null),
        classifyCall,
    ]);

    return {
        now,
        coachState: { ...coachState, pendingQuestion },
        profileContext,
        classification,
        safety,
        action,
        usage,
    };
}

// Node names must differ from state keys (LangGraph channels).
const N = {
    prepare: 'prepare',
    safety: 'safety_reply',
    quick: 'quick_reply',
    actions: 'profile_actions',
    gap: 'gap_check',
    specialists: 'run_specialists',
    respond: 'respond',
    persist: 'persist',
};

function routeAfterPrepare(state) {
    if (state.safety.flagged || state.classification.redFlag) return N.safety;
    if (!state.action && ['greeting', 'thanks'].includes(state.classification.intent)) return N.quick;
    return N.actions;
}

async function safetyNode(state, config) {
    const kind = state.safety.flagged ? state.safety.kind : 'emergency';
    const reply = safetyReply(kind, { language: state.classification.language });
    write(config, { type: 'token', text: reply });
    // No profile questions or saves during an emergency.
    return { reply, route: 'safety', nextCoachState: { ...state.coachState, pendingQuestion: null, pendingConfirm: null } };
}

async function quickNode(state, config) {
    const first = String(state.userName || '').trim().split(/\s+/)[0];
    const hinglish = ['hinglish', 'hindi'].includes(state.classification.language);
    const reply = state.classification.intent === 'thanks'
        ? (hinglish ? 'Koi baat nahi! Aur kuch poochna ho to bataiye.' : 'You\'re welcome! Let me know if there\'s anything else.')
        : `Hi${first ? ` ${first}` : ''}! ${hinglish ? 'Aaj main aapki kaise madad kar sakta hoon?' : 'How can I help you today?'}`;
    write(config, { type: 'token', text: reply });
    return { reply, route: 'quick', nextCoachState: { ...state.coachState } };
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

    // Facts in this message (none when it was only "yes" / "no" / "undo").
    const { saveNow, confirm } = state.action ? { saveNow: [], confirm: [] } : triageFacts(state.classification.facts, cs.pendingQuestion);
    if (saveNow.length) savedFacts = savedFacts.concat(await d.profileTools.saveFacts(state.userId, saveNow));
    if (savedFacts.length) {
        next.lastSaved = { items: savedFacts, savedAt: state.now };
        write(config, { type: 'profile_saved', items: savedFacts.map(({ target, value, none, historyId }) => ({ target, value, none, historyId })) });
    }
    if (confirm.length) {
        next.pendingConfirm = { facts: confirm, askedAt: state.now };
        write(config, { type: 'profile_confirm', facts: confirm.map(({ target, value, none }) => ({ target, value, none })) });
    }
    // The pending question has had its one chance to be answered.
    next.pendingQuestion = null;

    // Saved facts change the profile the answer should use.
    const profileContext = savedFacts.length || undoneCount
        ? await d.getProfileContext(state.userId, { fresh: true }).catch(() => state.profileContext)
        : state.profileContext;

    return { savedFacts, confirmFacts: confirm, undoneCount, nextCoachState: next, profileContext };
}

async function gapNode(state) {
    if (state.action) return { gapQuestion: null };
    // Don't stack a profile question on top of a "save this?" question.
    if (state.confirmFacts?.length) return { gapQuestion: null };
    const gapQuestion = pickGapQuestion(state.classification, state.profileContext, state.nextCoachState.askedLog, state.now);
    return { gapQuestion };
}

function routeAfterGap(state) {
    const needs = state.classification.specialists?.length > 0 && !state.gapQuestion?.blocking && !state.action;
    return needs ? N.specialists : N.respond;
}

async function specialistsNode(state, config) {
    const d = deps(config);
    const specialistResults = await runSpecialists(state.classification.specialists, {
        userId: state.userId, now: state.now, deps: d.specialistDeps || {}, logger: d.logger,
    });
    return { specialistResults };
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
    });
    const out = await streamAnswer({
        client: d.client,
        request,
        signal: d.signal,
        onToken: (text) => write(config, { type: 'token', text }),
    });

    const next = { ...state.nextCoachState };
    if (state.gapQuestion) {
        next.pendingQuestion = { field: state.gapQuestion.field, question: state.gapQuestion.question, askedAt: state.now };
        next.askedLog = { ...(next.askedLog || {}), [state.gapQuestion.field]: state.now };
    }
    return {
        reply: out.text,
        route: 'coach',
        nextCoachState: next,
        usage: [{ feature: 'ai_coach_v2', model: out.model, usage: out.usage, stopReason: out.stopReason }],
    };
}

async function persistNode(state, config) {
    const d = deps(config);
    try {
        await d.coachStateRepo.save(state.userId, state.nextCoachState || state.coachState || {});
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
        .addNode(N.quick, quickNode)
        .addNode(N.actions, actionsNode)
        .addNode(N.gap, gapNode)
        .addNode(N.specialists, specialistsNode)
        .addNode(N.respond, respondNode)
        .addNode(N.persist, persistNode)
        .addEdge(START, N.prepare)
        .addConditionalEdges(N.prepare, routeAfterPrepare, [N.safety, N.quick, N.actions])
        .addEdge(N.actions, N.gap)
        .addConditionalEdges(N.gap, routeAfterGap, [N.specialists, N.respond])
        .addEdge(N.specialists, N.respond)
        .addEdge(N.safety, N.persist)
        .addEdge(N.quick, N.persist)
        .addEdge(N.respond, N.persist)
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
    const stream = await graph.stream(input, { streamMode: ['custom', 'values'], configurable: { deps: d } });
    for await (const [mode, chunk] of stream) {
        if (mode === 'custom') onEvent(chunk);
        else finalState = chunk;
    }
    return finalState;
}

module.exports = { buildCoachGraph, getCoachGraph, runCoach, routeAfterPrepare, routeAfterGap };
