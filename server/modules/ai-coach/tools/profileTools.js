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

const LIST_TARGETS = ['allergies', 'medications', 'conditions', 'surgeries', 'familyHistory'];
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

const YES_RE = /^\s*(yes|yeah|yep|yup|haan|haa|ha|han|ji|ji haan|sure|ok|okay|save( it)?|kar do|save kar do|theek hai|thik hai|correct|right)\b/i;
const NO_RE = /^\s*(no|nope|nahi|nahin|nhi|mat|don'?t|dont|cancel|rehne do)\b/i;
// Undo must be a short, direct instruction: "what's wrong with my sleep?"
// right after a save must NOT revert it.
const UNDO_RE = /\b(undo|hata do|hatao|remove (that|it)|delete (that|it)|galat (save|tha)|wrong save|that'?s (wrong|not right)|vo galat hai|woh galat hai|save mat karo)\b/i;
const MAX_UNDO_WORDS = 8;
const UNDO_WINDOW_MS = 30 * 60 * 1000;
const CONFIRM_WINDOW_MS = 30 * 60 * 1000;

const isYes = (m) => YES_RE.test(m);
const isNo = (m) => NO_RE.test(m);
const isUndo = (m) => UNDO_RE.test(m) && String(m).trim().split(/\s+/).length <= MAX_UNDO_WORDS;

// Which facts to save now, which to confirm first, which to ignore.
function triageFacts(facts = [], pendingQuestion = null) {
    const saveNow = [];
    const confirm = [];
    const answered = pendingQuestion ? (ANSWERS[pendingQuestion.field] || [pendingQuestion.field]) : [];
    for (const f of facts) {
        if (!f || f.statedAs === 'question' || f.statedAs === 'hypothetical' || f.aboutSelf === false) continue;
        if (!f.none && !String(f.value || '').trim()) continue;
        if (f.statedAs === 'answer' && answered.includes(f.target)) saveNow.push(f);
        else confirm.push(f);
    }
    return { saveNow, confirm };
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
        conditions: 'health condition', surgeries: 'surgery', familyHistory: 'family history',
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
                saved.push({ target: f.target, value: f.value, none: Boolean(f.none), historyId: await latestHistoryId(userId, out.field) });
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
    async function undoSaved(userId, items = []) {
        let undone = 0;
        for (const item of [...items].reverse()) {
            if (!item?.historyId) continue;
            try {
                await service.undo(userId, item.historyId, { source: 'chat' });
                undone++;
            } catch (err) {
                logger.warn(`[AICoach] undo of ${item.target} skipped: ${err.message}`);
            }
        }
        return undone;
    }

    return { saveFacts, undoSaved };
}

module.exports = {
    createProfileTools,
    triageFacts,
    describeFact,
    splitDose,
    listItem,
    isYes,
    isNo,
    isUndo,
    UNDO_WINDOW_MS,
    CONFIRM_WINDOW_MS,
};
