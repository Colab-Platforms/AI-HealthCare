// Chat opener: the coach's first message when the user OPENS the coach screen
// (never on app launch, never a push or a popup). Code only, no model call:
// ~fast, free, and every number comes straight from the data.
//
//   Good morning Rahul!
//   Last 7 days: 6,240 steps a day on average (goal 8,000 met on 3 of 7 days), 6.4 h sleep a night (goal 7 h), meals logged on 4 days.
//   How is your stomach burning now?
//
// Rules (agreed 24 Nov, "must not be irritating"):
// - at most once a day, and not on a day the user already chatted;
// - nothing to say (no routine data, no question) -> no opener at all;
// - at most ONE question: an open symptom first, else an important missing
//   profile fact; the same snoozes and 30-min question cooldown as the chat;
// - the question is remembered (pendingQuestion / symptom asked), so the
//   user's reply is read as its answer.

const { pickGapQuestion } = require('../orchestrator/gapEngine');
const { inQuestionCooldown, askedWithin, QUESTIONS, LAST_ASK_KEY } = require('../orchestrator/checkIns');

const IST_OFFSET_MS = 330 * 60 * 1000; // India Standard Time, UTC+5:30
const istDay = (d) => new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const istHour = (d) => new Date(new Date(d).getTime() + IST_OFFSET_MS).getUTCHours();
// A symptom asked about in the last 12 h is not asked again by the opener.
const SYMPTOM_REASK_MS = 12 * 3600 * 1000;
// Profile facts worth asking for unprompted, most important first.
const OPENER_TOPICS = ['nutrition', 'medical_lab', 'general'];

const fmtNum = (n) => Math.round(n).toLocaleString('en-IN');

// Same in English and Hinglish: that's how people greet in Hinglish chat too.
function greeting(now, firstName) {
    const h = istHour(now);
    const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return `${part}${firstName ? ` ${firstName}` : ''}!`;
}

// One line about the last 7 complete days, only parts with data.
function routineLine(summary, hinglish) {
    if (!summary?.thisWeek) return null;
    const w = summary.thisWeek;
    const t = summary.targets || {};
    const parts = [];
    if (w.stepDays > 0 && w.stepsAvg != null) {
        const goal = t.steps ? (hinglish
            ? ` (goal ${fmtNum(t.steps)}, ${w.stepGoalDays}/${w.stepDays} din poora)`
            : ` (goal ${fmtNum(t.steps)} met on ${w.stepGoalDays} of ${w.stepDays} days)`) : '';
        parts.push(hinglish ? `roz avg ${fmtNum(w.stepsAvg)} steps${goal}` : `${fmtNum(w.stepsAvg)} steps a day on average${goal}`);
    }
    if (w.sleepNights > 0 && w.sleepAvg != null) {
        const goal = t.sleepHours ? ` (goal ${t.sleepHours} h)` : '';
        parts.push(hinglish ? `neend avg ${w.sleepAvg} h${goal}` : `${w.sleepAvg} h sleep a night${goal}`);
    }
    if (w.kcalDays > 0) {
        parts.push(hinglish ? `khana ${w.kcalDays} din log kiya` : `meals logged on ${w.kcalDays} day${w.kcalDays === 1 ? '' : 's'}`);
    }
    if (!parts.length) return null;
    return hinglish ? `Pichhle 7 din: ${parts.join(', ')}.` : `Last 7 days: ${parts.join(', ')}.`;
}

function pickQuestion({ state, symptoms, profileContext, language, now }) {
    const askedLog = state.askedLog || {};
    if (inQuestionCooldown(askedLog, now)) return null;
    const hinglish = language === 'hinglish' || language === 'hindi';

    const symptom = (symptoms || [])
        .filter((s) => !askedWithin(s.lastAskedAt, SYMPTOM_REASK_MS, now))
        .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))[0];
    if (symptom) {
        const q = QUESTIONS.symptom(symptom.name);
        return { kind: 'symptom', key: `symptom:${symptom.key}`, symptomId: symptom._id, text: hinglish ? q.hi : q.en };
    }

    if (profileContext) {
        const gap = pickGapQuestion({ intent: 'health_coaching', topics: OPENER_TOPICS, language }, profileContext, askedLog, now);
        if (gap) return { kind: 'gap', key: gap.field, field: gap.field, text: gap.question };
    }
    return null;
}

function createOpenerService(deps) {
    const logger = deps.logger || console;

    async function buildOpener({ userId, userName, now = new Date() }) {
        const state = await deps.coachStateRepo.load(userId);
        if (state.lastOpenerAt && istDay(state.lastOpenerAt) === istDay(now)) return { opener: null, reason: 'already_today' };
        if (state.lastChatAt && istDay(state.lastChatAt) === istDay(now)) return { opener: null, reason: 'chatted_today' };

        const language = state.lastLanguage || 'english';
        const hinglish = language === 'hinglish' || language === 'hindi';
        const [progress, symptoms, profileContext] = await Promise.all([
            deps.progress({ userId, now }).catch((e) => { logger.warn(`[AICoach] opener progress failed: ${e.message}`); return null; }),
            deps.symptomTools ? deps.symptomTools.listActive(userId).catch(() => []) : Promise.resolve([]),
            deps.getProfileContext(userId).catch(() => null),
        ]);

        const routine = routineLine(progress?.summary, hinglish);
        const question = pickQuestion({ state, symptoms, profileContext, language, now });
        if (!routine && !question) return { opener: null, reason: 'nothing_to_say' };

        const firstName = String(userName || '').trim().split(/\s+/)[0];
        const text = [greeting(now, firstName), routine, question?.text].filter(Boolean).join('\n');

        // Remember: once a day, and what was asked (so the reply is read as its answer).
        const next = { ...state, lastOpenerAt: now };
        if (question) {
            next.askedLog = { ...(state.askedLog || {}), [question.key]: now, [LAST_ASK_KEY]: now };
            if (question.kind === 'gap') next.pendingQuestion = { field: question.field, question: question.text, askedAt: now };
            if (question.kind === 'symptom' && deps.symptomTools) {
                await deps.symptomTools.markAsked(question.symptomId, now).catch((e) => logger.warn(`[AICoach] opener symptom ask not recorded: ${e.message}`));
            }
        }
        await deps.coachStateRepo.save(userId, next);

        return {
            opener: {
                text,
                language,
                question: question ? { kind: question.kind, field: question.field || null } : null,
            },
        };
    }

    return { buildOpener };
}

module.exports = { createOpenerService, routineLine, istDay };
