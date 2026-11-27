// Chat -> profile: turns the classifier's extracted facts into HealthProfile
// writes through ProfileWriteService (source 'chat'), following the save rules
// in docs/ai-coach-technical-spec.md section 7:
//
//   coach asked, user answered          -> save now, offer Undo
//   user said "none"                    -> markNone (via the same path)
//   user volunteered a fact             -> ask "save this?" first
//   question / hypothetical / not self  -> save nothing
//
// The user id always comes from the request, never from the model.

const writeService = require('../../health-profile/services/profileWriteService');

const LIST_TARGETS = ['allergies', 'medications', 'conditions', 'surgeries', 'familyHistory', 'disabilities', 'intolerances', 'mentalHealth'];
const SCALAR_TARGETS = {
    'diet.preference': ['diet', 'preference', 'string'],
    'basic.age': ['basic', 'age', 'number'],
    'body.heightCm': ['body', 'heightCm', 'number'],
    'body.weightKg': ['body', 'weightKg', 'number'],
    'lifestyle.smoking': ['lifestyle', 'smoking', 'string'],
    'lifestyle.alcohol': ['lifestyle', 'alcohol', 'string'],
    'lifestyle.sleepHours': ['lifestyle', 'sleepHours', 'number'],
    'lifestyle.stressLevel': ['lifestyle', 'stressLevel', 'string'],
};
// Gap-engine field -> fact targets that answer it.
const ANSWERS = {
    basics: ['basic.age', 'body.heightCm', 'body.weightKg'],
};

// Stretched and casual forms too (staging 25 Nov: "yess" was not a yes, the
// model then said "saving it now" and nothing was saved).
const YES_RE = /^\s*(y+e+s+|yea+h*|yep+|yup+|ha+n*|ha+n* ?ji|ji+|ji ha+n*|sure|ok+|o+kay+|okk*|bilkul|zaroor|haa?n bhai|save( it| karo| kar do| kardo)?|kar do|kardo|kar de|karde|theek hai|thik hai|correct|right|go ahead|do it)\b/i;
const NO_RE = /^\s*(n+o+|nope|nah|na+hi+n?|nhi+|mat|don'?t|dont|cancel|rehne do|rehne de)\b/i;
// Undo must be a short, direct instruction: "what's wrong with my sleep?"
// right after a save must NOT revert it.
const UNDO_RE = /\b(undo|hata do|hatao|remove (that|it)|delete (that|it)|galat (save|tha)|wrong save|that'?s (wrong|not right)|vo galat hai|woh galat hai|save mat karo)\b/i;
const MAX_UNDO_WORDS = 8;
const UNDO_WINDOW_MS = 30 * 60 * 1000;
const CONFIRM_WINDOW_MS = 30 * 60 * 1000;

const isYes = (m) => YES_RE.test(m);
const isNo = (m) => NO_RE.test(m);
const isUndo = (m) => UNDO_RE.test(m) && String(m).trim().split(/\s+/).length <= MAX_UNDO_WORDS;

// Fields where only a specific value is useful ("knee pain", "Metformin",
// "Peanut"). "yes" / "an injury" / "unspecified" there is junk (staging 24 Nov:
// "haan" saved fitness.limitations = "Yes, has an injury or pain (unspecified)").
const SPECIFIC_TARGETS = [...LIST_TARGETS, 'fitness.limitations'];
const VAGUE_RE = new RegExp('^(' + [
    'yes|yeah|yep|haan|haa|ha|han|ji|true|hai|ha hai|haan hai',
    'some|kuch|thoda|unknown|unspecified|not sure|pata nahi|maybe|shayad|n/?a|other',
    '.*\\bunspecified\\b.*|.*\\bunknown\\b.*|yes\\b.*',
    'has (an? |some )?(injury|pain|allergy|allergies|condition|medicine|medication|surgery)s?\\b.*',
    '((an?|some|old|purani|purana|minor|chhoti|ek|thodi|thoda) )?(injury|injuries|pain|dard|chot|allergy|allergies|condition|bimari|medicine|medicines|medication|dawai|dawa|tablet|goli|surgery|operation)',
].join('|') + ')$', 'i');

function isVague(f) {
    if (!f || f.none || !SPECIFIC_TARGETS.includes(f.target)) return false;
    const v = String(f.value || '').trim().replace(/[.!]+$/, '').toLowerCase();
    return !v || VAGUE_RE.test(v);
}

// The follow-up when the user said "yes" but not what. One thing only.
const SPECIFY_QUESTIONS = {
    'fitness.limitations': { en: 'Where exactly is the injury or pain?', hi: 'Injury ya dard exactly kahan hai?' },
    medications: { en: 'What is the name of the medicine?', hi: 'Dawai ka naam kya hai?' },
    allergies: { en: 'What are you allergic to?', hi: 'Kis cheez se allergy hai?' },
    conditions: { en: 'Which health condition is it?', hi: 'Kaunsi health condition hai?' },
    surgeries: { en: 'Which surgery was it?', hi: 'Kaunsi surgery hui thi?' },
    familyHistory: { en: 'Which condition runs in your family?', hi: 'Family mein kaunsi bimari hai?' },
    disabilities: { en: 'Which disability is it?', hi: 'Kaunsi disability hai?' },
    intolerances: { en: 'Which food doesn\'t suit you?', hi: 'Kaunsa khana suit nahi karta?' },
    mentalHealth: { en: 'What would you like me to note?', hi: 'Kya note karun?' },
};
function specifyQuestion(field, hinglish = false) {
    const q = SPECIFY_QUESTIONS[field];
    return q ? (hinglish ? q.hi : q.en) : null;
}
function specifyQuestionAlt(field, hinglish = false) {
    const q = SPECIFY_QUESTIONS[field];
    return q ? (hinglish ? q.en : q.hi) : null;
}

// Which facts to save now, which to confirm first, which to ignore.
// `vague`: facts that need a specific value first (never saved or confirmed).
function triageFacts(facts = [], pendingQuestion = null) {
    const saveNow = [];
    const confirm = [];
    const vague = [];
    const answered = pendingQuestion ? (ANSWERS[pendingQuestion.field] || [pendingQuestion.field]) : [];
    for (const f of facts) {
        if (!f || f.statedAs === 'question' || f.statedAs === 'hypothetical' || f.aboutSelf === false) continue;
        if (isVague(f)) { vague.push(f); continue; }
        if (!f.none && !String(f.value || '').trim()) continue;
        if (f.statedAs === 'answer' && answered.includes(f.target)) saveNow.push(f);
        else confirm.push(f);
    }
    return { saveNow, confirm, vague };
}

// "Metformin 500mg" -> { name: 'Metformin', dose: '500mg' }
function splitDose(value) {
    const m = /^(.*?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|iu|ml|units?))$/i.exec(value.trim());
    return m ? { name: m[1].trim(), dose: m[2].replace(/\s+/g, '') } : { name: value.trim() };
}

function listItem(target, value) {
    const v = value.trim();
    switch (target) {
        case 'allergies': return { allergen: v };
        case 'medications': return splitDose(v);
        case 'familyHistory': {
            const m = /^([^:]+):\s*(.+)$/.exec(v);
            return m ? { relation: m[1].trim(), condition: m[2].trim() } : { condition: v };
        }
        default: return { name: v }; // conditions, surgeries
    }
}

function describeFact(f, hinglish = false) {
    const label = {
        allergies: hinglish ? 'allergy' : 'allergy', medications: hinglish ? 'dawai' : 'medicine',
        conditions: 'health condition', surgeries: 'surgery', familyHistory: 'family history', disabilities: 'physical disability', intolerances: 'food intolerance', mentalHealth: 'mental health',
        'fitness.limitations': hinglish ? 'injury / limitation' : 'injury / limitation',
        'diet.preference': 'diet', 'basic.age': 'age', 'body.heightCm': 'height (cm)', 'body.weightKg': 'weight (kg)',
        'lifestyle.smoking': 'smoking', 'lifestyle.alcohol': 'alcohol', 'lifestyle.sleepHours': 'usual sleep (hours)',
        'lifestyle.stressLevel': 'stress level',
    }[f.target] || f.target;
    if (f.none) return hinglish ? `koi ${label} nahi` : `no ${label}`;
    return `${label}: ${f.value}`;
}

function createProfileTools({
    service = writeService,
    repo = require('../../health-profile/services/profileRepo').mongoRepo,
    sideEffects = require('../../health-profile/services/profileSideEffects').createProfileSideEffects(),
    // Weight said in chat goes through the app's own weight log (graph, goal,
    // BMI, profile), not just the profile field.
    logWeight = (args) => require('../../../services/weightLogService').logWeight(args),
    // Reverts the chat's weigh-in: a reading the chat created is deleted, a
    // same-day reading it overwrote gets its old value back (only if nobody
    // changed it since). The entry logWeight pushed into the HealthGoal's
    // weeklyWeightLogs goes too (same weight, within 2 min of the save).
    // Staging 25 Nov: undo left today's reading and the goal log at 69 kg.
    revertWeightLog = async (log, userId) => {
        const HealthMetric = require('../../../models/HealthMetric');
        if (log.metricId) {
            const own = { _id: log.metricId, userId, type: 'weight', value: log.kg };
            if (log.created) await HealthMetric.deleteOne(own);
            else if (log.previousValue > 0) await HealthMetric.updateOne(own, { $set: { value: log.previousValue } });
        }
        const t = new Date(log.loggedAt).getTime();
        if (!Number.isFinite(t)) return;
        await require('../../../models/HealthGoal').updateOne({ userId }, {
            $pull: { weeklyWeightLogs: { weight: log.kg, date: { $gte: new Date(t - 120000), $lte: new Date(t + 120000) } } },
        });
    },
    logger = console,
} = {}) {
    const { ProfileInputError } = writeService;
    const opts = { source: 'chat', verified: true };

    async function latestHistoryId(userId, field) {
        const [row] = await repo.listHistory(userId, { field, limit: 1 });
        return row?._id ? String(row._id) : null;
    }

    async function saveOne(userId, f) {
        if (LIST_TARGETS.includes(f.target)) {
            const res = f.none
                ? await service.markNone(userId, f.target, opts)
                : await service.addItem(userId, f.target, listItem(f.target, f.value), opts);
            return { res, field: f.target };
        }
        if (f.target === 'fitness.limitations') {
            const current = (await repo.findProfile(userId))?.fitness?.limitations || [];
            const next = f.none
                ? ['none']
                : [...new Set([...current.filter((x) => x !== 'none'), f.value.trim()].map((x) => x.toLowerCase()))];
            const res = await service.updateSection(userId, 'fitness', { limitations: next }, opts);
            return { res, field: 'fitness.limitations' };
        }
        if (f.target === 'body.weightKg' && !f.none) {
            const kg = Number(String(f.value).replace(/[^\d.]/g, ''));
            if (!Number.isFinite(kg) || kg <= 0 || kg > 500) return null;
            const before = (await repo.findProfile(userId))?.body?.weightKg;
            const loggedAt = new Date().toISOString();
            const { metric, created, previousValue } = await logWeight({ userId, weightKg: kg, source: 'chat' });
            // Profile already written inside logWeight (with its own side effects).
            // What undo needs to put the weight log back exactly.
            const weightLog = {
                kg, loggedAt, created: Boolean(created),
                metricId: metric?._id ? String(metric._id) : null,
                previousValue: created ? null : (previousValue ?? null),
            };
            return { res: { changed: before !== kg, sections: [] }, field: 'body.weightKg', weightLog };
        }
        const map = SCALAR_TARGETS[f.target];
        if (!map || f.none) return null;
        const [section, key, type] = map;
        let value = f.value.trim();
        if (type === 'number') {
            value = Number(value.replace(/[^\d.]/g, ''));
            if (!Number.isFinite(value) || value <= 0) return null;
        } else {
            value = value.toLowerCase();
        }
        const res = await service.updateSection(userId, section, { [key]: value }, opts);
        return { res, field: `${section}.${key}` };
    }

    // Saves facts one by one; a fact that fails validation is skipped, never
    // fails the chat. Returns what was actually changed (for Undo).
    async function saveFacts(userId, facts) {
        const saved = [];
        const sections = new Set();
        for (const f of facts) {
            try {
                const out = await saveOne(userId, f);
                if (!out?.res?.changed) continue;
                (out.res.sections || []).forEach((s) => sections.add(s));
                saved.push({
                    target: f.target, value: f.value, none: Boolean(f.none),
                    historyId: await latestHistoryId(userId, out.field),
                    ...(out.weightLog ? { weightLog: out.weightLog } : {}),
                });
            } catch (err) {
                // No values in logs: health data.
                if (err instanceof ProfileInputError) logger.warn(`[AICoach] fact for ${f.target} not saved: invalid`);
                else logger.error(`[AICoach] fact for ${f.target} not saved: ${err.message}`);
            }
        }
        if (sections.size) await sideEffects.afterProfileChange(userId, [...sections]);
        return saved;
    }

    // Reverts the last saved batch, newest first. A change already superseded
    // by a newer edit is left alone.
    // Then runs the same side effects as a save (staging 25 Nov: undoing a chat
    // weight of 70 kg left the HealthGoal at 70, so calories stayed 2804
    // while the profile was back at 78).
    async function undoSaved(userId, items = []) {
        let undone = 0;
        const sections = new Set();
        for (const item of [...items].reverse()) {
            if (!item?.historyId) continue;
            try {
                const res = await service.undo(userId, item.historyId, { source: 'chat' });
                (res?.sections || []).forEach((s) => sections.add(s));
                // The weigh-in goes back too, or the graph and goal keep the wrong number.
                // (metricId alone: an item saved before weightLog existed.)
                const log = item.weightLog || (item.metricId ? { metricId: item.metricId, created: true, kg: Number(String(item.value).replace(/[^\d.]/g, '')) } : null);
                if (log) await revertWeightLog(log, userId);
                undone++;
            } catch (err) {
                logger.warn(`[AICoach] undo of ${item.target} skipped: ${err.message}`);
            }
        }
        if (sections.size) {
            try {
                await sideEffects.afterProfileChange(userId, [...sections]);
            } catch (err) {
                logger.error(`[AICoach] side effects after undo failed: ${err.message}`);
            }
        }
        return undone;
    }

    return { saveFacts, undoSaved };
}

module.exports = {
    createProfileTools,
    triageFacts,
    isVague,
    specifyQuestion,
    specifyQuestionAlt,
    SPECIFIC_TARGETS,
    describeFact,
    splitDose,
    listItem,
    isYes,
    isNo,
    isUndo,
    UNDO_WINDOW_MS,
    CONFIRM_WINDOW_MS,
};
