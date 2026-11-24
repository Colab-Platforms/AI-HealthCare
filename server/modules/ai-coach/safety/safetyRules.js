// Red-flag detection: deterministic code that runs on EVERY message before any
// coaching. A match means the reply is a fixed safety message, not coaching.
// English + Hinglish. False positives are cheaper than misses here, but plain
// negations ("no chest pain", "seene mein dard nahi") are not flags.
//
// The classifier also returns `redFlag`; that is a second net for phrasings
// these rules don't know. These rules never depend on the model.

const EMERGENCY = 'emergency';
const MENTAL_HEALTH = 'mental_health_crisis';

const RULES = [
    // Heart / breathing / stroke / consciousness
    // "jalan" (burning) is left out on purpose: "seene mein jalan" is usually acidity.
    { kind: EMERGENCY, label: 'chest pain', re: /\b(chest pain|pain in (my )?chest|chest (tightness|pressure)|tight chest|(seene|seena|chhati|chhaati|chaati|chati|chest|dil)( (me|mein|mai|main|mei|par|pe))?( (bahut|bohot|tez|thoda|ajeeb|bhaari|zor ka|zor se))? (dard|dabav|dabaav|jakdan|jakadan|pain|bhaaripan|bharipan))\b/i },
    // "saans phool rahi" (happening now) is a flag; "saans phoolti hai" (habitual, after running) is not.
    { kind: EMERGENCY, label: 'breathing difficulty', re: /\b(can'?t breathe|cannot breathe|difficulty breathing|trouble breathing|short(ness)? of breath|breathless(ness)?|saa?ns (lene )?(me|mein|mai) (dikkat|takleef|taklif|problem)|saa?ns (nahi|nhi|nahin) (aa|le pa) (rahi|raha|rhi|rha)|saa?ns( (bahut|bohot|kaafi))? (phool|phul|ful) (rahi|raha|rhi|rha)|saa?ns (ruk|atak) (rahi|raha|gayi|gaya)|dum ghut (raha|rahi|rha|rhi))\b/i },
    // Left arm numbness / heaviness / pain can be a heart-attack sign.
    { kind: EMERGENCY, label: 'left arm numbness', re: /\b((left|baaye|baayen|baayein|bayen|bayein|baen|ulte) (haath|hath|arm|baazu|bazu|kandha|kandhe)( (me|mein|mai|main|mei))?( (bahut|thoda|ekdum))? (sunn|sun|numb|bhaari|bhari|jhunjhuni|jhanjhanahat|tingling|dard|pain)|left arm (is |feels |feeling )?(numb|tingling|heavy|weak)|(numbness|tingling|pain) (going )?(in|down) (my )?left arm)\b/i },
    { kind: EMERGENCY, label: 'fainting', re: /\b(faint(ed|ing)?|passed out|blacked out|lost consciousness|unconscious|behosh|chakkar kha ke gir)\b/i },
    { kind: EMERGENCY, label: 'stroke signs', re: /\b(face (is )?drooping|slurred speech|sudden (weakness|numbness)|one side (of my body )?(is )?(weak|numb)|can'?t (move|feel) (my )?(arm|leg|face))\b/i },
    { kind: EMERGENCY, label: 'seizure', re: /\b(seizure|convulsion|fits? aa (gaya|gayi|rahe))\b/i },
    { kind: EMERGENCY, label: 'severe bleeding', re: /\b(heavy bleeding|bleeding (heavily|a lot|won'?t stop)|vomiting blood|blood in (my )?vomit|khoon (ki )?ulti)\b/i },
    { kind: EMERGENCY, label: 'severe allergic reaction', re: /\b(throat (is )?(closing|swelling)|swollen (throat|tongue)|anaphyla\w*|gala (band|sujh))\b/i },
    // Mental health crisis
    { kind: MENTAL_HEALTH, label: 'self-harm', re: /\b(suicid\w*|kill (my ?self|myself)|end (my|it) (life|all)|want to die|don'?t want to live|self[- ]harm|hurt myself|marna chahta|marna chahti|mar jaana chahta|mar jaana chahti|jeena nahi chahta|jeena nahi chahti|khud ko (khatam|nuksan|hurt))\b/i },
];

// Negation right before ("no chest pain") or right after in Hinglish
// ("seene mein dard nahi hai"). Window: a few words.
const NEG_BEFORE = /\b(no|not|without|never|don'?t have|didn'?t have|denies)\s+(\w+\s+){0,2}$/i;
const NEG_AFTER = /^\s*(\w+\s+){0,1}(nahi|nhi|nahin|nai)\b/i;
// Crisis phrases are never negation-filtered: "I don't want to live" contains "don't".

// Numeric glucose emergencies, e.g. "sugar 45", "glucose is 480 mg/dL".
const GLUCOSE_RE = /\b(sugar|glucose|bg|blood sugar)\D{0,12}(\d{2,3})\b/i;

// Product decision (24 Nov): chest pain or breathlessness tied to exercise
// ("chest workout ke baad chest mein dard", "gym ke baad saans phool rahi") is
// usually soreness / normal effort, so it gets coaching + a fixed caution line
// instead of the emergency reply. Any severe sign in the same message keeps it
// an emergency.
const SOFTENABLE = new Set(['chest pain', 'breathing difficulty']);
const EXERCISE_CONTEXT_RE = /\b(gym|workout|work ?out|exercise|training|run(ning)?|jog(ging)?|daud|cardio|chest day|push ?-?ups?|bench|lifting|weights?|sports?|cricket|football|match|cycling|kasrat|vyayam)\b/i;
const SEVERE_SIGN_RE = /\b(left|baaye|baayen|bayen|ulte) (haath|hath|arm|baazu|kandha|kandhe)|\b(jaw|jabda|jabde)\b|\b(sweat\w*|pasina|paseena)\b|\b(chakkar|dizzy|dizziness|behosh|faint\w*)\b|\b(tez|bahut|bohot|severe|unbearable|crushing|intense)\b|aaram (karne )?(pe|par|mein|me) bhi|even (at|when) rest|at rest|rest (karne )?ke baad bhi|ruk (nahi|nhi) (raha|rahi)|won'?t stop|ghabrahat|\b(ulti|vomit\w*)\b/i;

function checkMessage(text) {
    const message = String(text || '');
    let caution = null;
    for (const rule of RULES) {
        const m = rule.re.exec(message);
        if (!m) continue;
        if (rule.kind === EMERGENCY) {
            const before = message.slice(0, m.index);
            const after = message.slice(m.index + m[0].length);
            if (NEG_BEFORE.test(before) || NEG_AFTER.test(after)) continue;
            if (SOFTENABLE.has(rule.label) && EXERCISE_CONTEXT_RE.test(message) && !SEVERE_SIGN_RE.test(message)) {
                caution = caution || { kind: 'exercise', reason: `${rule.label} after exercise` };
                continue; // other rules may still flag this message
            }
        }
        return { flagged: true, kind: rule.kind, reason: rule.label };
    }
    const g = GLUCOSE_RE.exec(message);
    if (g) {
        const value = Number(g[2]);
        if (value > 0 && (value < 54 || value > 400)) {
            return { flagged: true, kind: EMERGENCY, reason: `blood sugar ${value}` };
        }
    }
    return caution ? { flagged: false, caution } : { flagged: false };
}

// Fixed line appended after the coach's answer for exercise-related chest pain
// or breathlessness: when it becomes an emergency.
function exerciseCautionLine({ language = 'english' } = {}) {
    const hinglish = language === 'hinglish' || language === 'hindi';
    return hinglish
        ? 'Dhyan rahe: agar dard tez ho, baaye haath, jabde ya peeth tak jaaye, pasina ya chakkar aaye, ya aaram karne pe bhi saans na sudhre, to turant 112 ya 108 pe call kariye.'
        : 'Important: if the pain gets strong, spreads to your left arm, jaw or back, comes with sweating or dizziness, or your breathing doesn\'t settle with rest, call 112 or 108 right away.';
}

// Fixed replies (India numbers). Short, calm, no coaching mixed in.
function safetyReply(kind, { language = 'english' } = {}) {
    const hinglish = language === 'hinglish' || language === 'hindi';
    if (kind === MENTAL_HEALTH) {
        return hinglish
            ? 'Aap jo mehsoos kar rahe hain, wo bahut bhaari lag raha hai, aur aap akele nahi hain. Abhi kisi se baat kariye: Tele-MANAS helpline 14416 (24x7, free) pe call kariye, ya kisi bharosemand insaan ko bataiye. Agar aap turant khatre mein hain, to 112 pe call kariye.'
            : 'I\'m really sorry you\'re feeling this way, and you don\'t have to go through it alone. Please talk to someone now: call the Tele-MANAS helpline at 14416 (free, 24x7), or reach out to someone you trust. If you are in immediate danger, call 112.';
    }
    return hinglish
        ? 'Ye symptom serious ho sakta hai. Kripya abhi turant medical help lijiye: 112 (emergency) ya 108 (ambulance) pe call kariye, ya nazdeeki hospital jaiye. Jab tak help aaye, akele mat rahiye aur koi workout ya dawai apne aap mat lijiye.'
        : 'This could be serious. Please get medical help right away: call 112 (emergency) or 108 (ambulance), or go to the nearest hospital. Until help arrives, don\'t stay alone and don\'t start any workout or medicine on your own.';
}

module.exports = { checkMessage, safetyReply, exerciseCautionLine, EMERGENCY, MENTAL_HEALTH };
