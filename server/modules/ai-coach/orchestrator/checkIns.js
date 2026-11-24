// Picks the ONE question the coach adds to this reply (or none). Pure function.
// Merges the gap engine (missing profile facts) with check-ins the coach
// raises on its own, so the user never gets two questions at once.
//
// Priority:
//   1. blocking gap question (advice would be unsafe without it)
//   2. follow-up on an active symptom (asked every 2 days until the user says it's gone)
//   3. non-blocking gap question
//   4. stale weight (goal involves weight + user is active, or just very old)
//   5. stale blood sugar (diabetic users)
//   6. vault file uploaded but never analysed
//   7. old lab report with out-of-range values (re-test)
// Each check-in has its own snooze (askedLog key) so it doesn't nag.

const DAY = 86400000;
const SNOOZE_DAYS = { weight: 7, glucose: 7, vault: 14, report: 30 };
const SYMPTOM_FOLLOWUP_DAYS = 2;
// Issue #6 (staging 24 Nov: injury, then weight, then weight again, and a
// weight question under "pait mein jalan hai"): after any non-blocking
// question, none for 30 min; none on a turn where the user reports a symptom.
// Blocking questions (needed for safe advice) are never held back.
const LAST_ASK_KEY = 'checkin:last';
const QUESTION_COOLDOWN_MS = 30 * 60 * 1000;
const inQuestionCooldown = (askedLog, now) => askedWithin(askedLog?.[LAST_ASK_KEY], QUESTION_COOLDOWN_MS, now);

const daysAgo = (date, now) => Math.floor((now.getTime() - new Date(date).getTime()) / DAY);
// Asked less than `ms` ago. An ask time more than 5 min in the future (bad
// clock, time-shifted test run) counts as not asked, so it can't snooze forever.
const askedWithin = (date, ms, now) => {
    if (!date) return false;
    const age = now.getTime() - new Date(date).getTime();
    return age > -5 * 60 * 1000 && age < ms;
};
const snoozed = (askedLog, key, days, now) => askedWithin(askedLog?.[key], days * DAY, now);
const fmt = (d) => new Date(d).toISOString().slice(0, 10);
const NO_CHECKIN_INTENTS = new Set(['greeting', 'thanks', 'small_talk', 'off_topic']);

// The exact question for check-ins the coach asks itself. Wording is fixed in
// code (staging 24 Nov: left to the model it asked "theek hua ya abhi bhi
// hai?", an A-or-B question). Both wordings go to the model, which asks in
// its reply's language.
const QUESTIONS = {
    symptom: (name) => ({ en: `How is your ${name} now?`, hi: `Ab ${name} kaisa hai?` }),
    weight: () => ({ en: 'What is your weight now?', hi: 'Abhi aapka weight kitna hai?' }),
};
function askExactly(q, hinglish) {
    const [main, alt] = hinglish ? [q.hi, q.en] : [q.en, q.hi];
    return `ask exactly this one question, in the language of your reply: "${main}" (other wording: "${alt}"). Do not add options such as "better or still the same?" or "X ya Y?".`;
}

// Which request topics a symptom changes the answer for. A related active
// symptom is asked about FIRST (user decision, 24 Nov): "meal generate karo"
// with an upset stomach on record -> "pait ab kaisa hai?" before the meal.
const SYMPTOM_TOPICS = [
    { re: /stomach|acid|acidity|gas|bloat|burn|nausea|vomit|diarr|loose motion|constipat|indigestion|gastr|pait|ulti|heartburn|reflux|appetite/i, topics: ['nutrition', 'supplements'] },
    { re: /tired|fatigue|exhaust|weak|low energy|sleepy|thak/i, topics: ['fitness', 'recovery', 'sleep', 'nutrition'] },
    { re: /pain|ache|sore|injur|sprain|strain|stiff|swell|dard|knee|back|shoulder|neck|ankle|wrist|hip/i, topics: ['fitness', 'recovery'] },
    { re: /headache|migraine|sir dard|dizz|chakkar/i, topics: ['fitness', 'nutrition', 'sleep'] },
    { re: /fever|cold|cough|flu|throat|bukhar|khansi|zukam/i, topics: ['fitness', 'nutrition', 'recovery'] },
    { re: /insomnia|can'?t sleep|sleep/i, topics: ['sleep', 'recovery', 'fitness'] },
    { re: /stress|anxi|tension|low mood|sad/i, topics: ['stress', 'sleep', 'recovery'] },
];
const BLOCKING_SYMPTOM_REASK_HOURS = 12; // never block twice in a row if the user skipped the question

// How directly a symptom bears on the request: 0 = the request's topic is the
// symptom's main (first) topic (stomach -> nutrition); higher = a side effect
// (fatigue -> nutrition is 4th). Infinity = not related.
function relevance(symptom, topics = []) {
    let best = Infinity;
    for (const g of SYMPTOM_TOPICS) {
        if (!g.re.test(symptom.name)) continue;
        g.topics.forEach((t, i) => { if (topics.includes(t) && i < best) best = i; });
    }
    return best;
}
const isRelated = (symptom, topics = []) => relevance(symptom, topics) < Infinity;

const WEIGHT_GOALS = new Set(['weight_loss', 'weight_gain', 'muscle_gain']);
const hasDiabetes = (ctx) => (ctx?.conditions?.items || []).some((c) => /diabet/i.test(c.name) && c.status !== 'resolved');

/**
 * @returns { kind, key, instruction, blocking, symptomId? } or null
 */
function pickCheckIn({ classification, gapQuestion, symptoms = [], symptomUpdates = [], freshness, profileContext, targets, askedLog = {}, now = new Date(), resuming = false }) {
    if (!classification || classification.redFlag || classification.distress || NO_CHECKIN_INTENTS.has(classification.intent)) return null;

    if (gapQuestion?.blocking) return { kind: 'gap', key: gapQuestion.field, blocking: true, question: gapQuestion.question, instruction: null };

    const hinglish = ['hinglish', 'hindi'].includes(classification.language);
    const updatedNow = new Set(symptomUpdates.map((u) => String(u.name).toLowerCase()));
    const fresh = (s) => updatedNow.has(s.key) || daysAgo(s.lastMentionedAt, now) < 1; // said in this message or today

    // 2a. a symptom RELATED to this request: ask first, answer after (blocking).
    // Not when resuming a paused request (that would loop), and not again within
    // 12 h if the user skipped the question.
    if (!resuming) {
        // Several related ones: the most directly related first (dinner question:
        // stomach burning before fatigue), then the most recently mentioned.
        const topics = classification.topics || [];
        const related = symptoms
            .filter((s) => !fresh(s) && isRelated(s, topics)
                && !askedWithin(askedLog?.[`symptom:${s.key}`], BLOCKING_SYMPTOM_REASK_HOURS * 3600000, now))
            .sort((a, b) => relevance(a, topics) - relevance(b, topics)
                || new Date(b.lastMentionedAt || b.startedAt) - new Date(a.lastMentionedAt || a.startedAt))[0];
        if (related) {
            const since = daysAgo(related.startedAt, now);
            return {
                kind: 'symptom', key: `symptom:${related.key}`, symptomId: related._id, blocking: true,
                question: QUESTIONS.symptom(related.name),
                instruction: `Before answering this request: ${since} days ago the user said they had ${related.name}${related.lastStatus && related.lastStatus !== 'new' ? ` (last update: ${related.lastStatus})` : ''}, and it changes what you would suggest. Do NOT give the plan or advice yet. Briefly say why, then ${askExactly(QUESTIONS.symptom(related.name), hinglish)} Keep it to 1-2 warm sentences.`,
            };
        }
    }

    // Everything below is non-blocking: hold it back right after another question.
    if (inQuestionCooldown(askedLog, now)) return null;
    // The user is telling us they feel unwell: no unrelated questions (other
    // symptoms, weight, sugar, vault, report). A profile question tied to THIS
    // request (e.g. injuries before gym advice) is still fine.
    const unwellNow = (classification.symptoms || []).length > 0;

    // 2b. symptom follow-up: oldest active one not talked about in this message
    for (const s of unwellNow ? [] : symptoms) {
        if (fresh(s)) continue;
        if (askedWithin(s.lastAskedAt, SYMPTOM_FOLLOWUP_DAYS * DAY, now)) continue;
        const since = daysAgo(s.startedAt, now);
        return {
            kind: 'symptom', key: `symptom:${s.key}`, symptomId: s._id,
            question: QUESTIONS.symptom(s.name),
            instruction: `Earlier (${since} days ago) the user said they had ${s.name}${s.lastStatus && s.lastStatus !== 'new' ? ` (last update: ${s.lastStatus})` : ''}; they haven't said it's gone.${since >= 14 ? ' It has lasted 2+ weeks: in one sentence before the question, gently suggest seeing a doctor if it is still there.' : ''} As the last line, warmly, ${askExactly(QUESTIONS.symptom(s.name), hinglish)}`,
        };
    }

    if (gapQuestion) return { kind: 'gap', key: gapQuestion.field, blocking: false, question: gapQuestion.question, instruction: null };
    if (unwellNow) return null;

    const f = freshness;
    if (!f) return null;
    const active = (f.activity?.foodDays14 || 0) >= 3 || (f.activity?.workouts14 || 0) >= 2;

    // 4. weight
    const weightGoal = WEIGHT_GOALS.has(targets?.targets?.goalType);
    const weightKg = profileContext?.body?.weightKg;
    const weightAge = f.weight ? daysAgo(f.weight.at, now) : null;
    // Never-logged weight (onboarding only) is asked about only when it matters:
    // a weight goal + an active user. Otherwise only a known, very old reading.
    const weightStale = weightKg && (
        (weightGoal && active && (weightAge === null || weightAge >= 14))
        || (weightAge !== null && weightAge >= 45)
    );
    if (weightStale && !snoozed(askedLog, 'checkin:weight', SNOOZE_DAYS.weight, now)) {
        const when = weightAge === null ? 'with no weigh-in logged' : `last logged ${weightAge} days ago (${fmt(f.weight.at)})`;
        const why = weightGoal && active
            ? `they're working towards ${targets.targets.goalType.replace(/_/g, ' ')}${targets.targets.targetWeightKg ? ` (target ${targets.targets.targetWeightKg} kg)` : ''} and have logged ${f.activity.foodDays14} days of meals and ${f.activity.workouts14} workouts in 2 weeks, so it has probably changed`
            : 'it may have changed since';
        return {
            kind: 'weight', key: 'checkin:weight',
            question: QUESTIONS.weight(),
            // Ask for the number, not "would you like to update it?": a bare
            // "yes" would need another turn to get the number.
            instruction: `Their weight on record is ${weightKg} kg, ${when}; ${why}. As the last line, in a friendly way, ${askExactly(QUESTIONS.weight(), hinglish)} It's fine if they skip it.`,
        };
    }

    // 5. blood sugar for diabetic users
    if (hasDiabetes(profileContext) && !snoozed(askedLog, 'checkin:glucose', SNOOZE_DAYS.glucose, now)) {
        const age = f.glucose ? daysAgo(f.glucose.at, now) : null;
        if (age === null || age >= 7) {
            return {
                kind: 'glucose', key: 'checkin:glucose',
                instruction: `They have diabetes and their last blood sugar log is ${age === null ? 'missing' : `${age} days old (${f.glucose.value})`}. As the last line, suggest logging a fresh reading in the app so your advice can use it.`,
            };
        }
    }

    // 6. vault files never analysed
    const vault = f.vaultFiles?.find((v) => !snoozed(askedLog, `checkin:vault:${v.id}`, SNOOZE_DAYS.vault, now));
    if (vault) {
        return {
            kind: 'vault', key: `checkin:vault:${vault.id}`,
            instruction: `They uploaded "${vault.title}" to their Vault on ${fmt(vault.at)}; Vault files are only stored, not read. As the last line, suggest uploading it under Reports for analysis so you can use its results in your advice.`,
        };
    }

    // 7. old lab report with out-of-range values
    if (f.report?.abnormal?.length && daysAgo(f.report.at, now) >= 120 && !snoozed(askedLog, 'checkin:report', SNOOZE_DAYS.report, now)) {
        return {
            kind: 'report', key: 'checkin:report',
            instruction: `Their latest lab report is ${daysAgo(f.report.at, now)} days old and had out-of-range ${f.report.abnormal.slice(0, 3).join(', ')}. As the last line, suggest a re-test and uploading it, so you can see whether it has improved.`,
        };
    }
    return null;
}

module.exports = { pickCheckIn, isRelated, relevance, inQuestionCooldown, askedWithin, QUESTIONS, SNOOZE_DAYS, SYMPTOM_FOLLOWUP_DAYS, LAST_ASK_KEY, QUESTION_COOLDOWN_MS };
