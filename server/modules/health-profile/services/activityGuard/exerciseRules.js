// Exercise x health profile rules (27 Nov). Pure and synchronous: no DB, no
// model call, so the same workout + the same profile always gives the same
// alerts, in well under a millisecond.
//
//   const facts = exerciseFacts(healthProfile, { symptoms });
//   const alerts = checkExercise({ activityType, intensity, duration }, facts);
//   // -> [{ code, level: 'important' | 'caution', text: { english, hinglish } }]
//
// Never blocks anything and never diagnoses: each alert says WHY (the fact
// from the profile) and one safe thing to do instead. Condition matching is
// shared with meal plans / the coach prompt (safetyConstraints.CONDITION_RULES),
// so the three never disagree about what a condition is.

const { ACTIVITY_LABEL, MET_VALUES, ACTIVITY_CATEGORY } = require('../../../../config/activityCatalog');
const { buildSafetyConstraints } = require('../safetyConstraints');

const set = (ids) => new Set(ids);

// ── activity traits ─────────────────────────────────────────────────────────
const HIGH_IMPACT = set(['running', 'jump_rope', 'hiit', 'basketball', 'football', 'badminton', 'squash', 'tennis', 'volleyball', 'skiing', 'boxing', 'kickboxing', 'martial_arts', 'wrestling', 'zumba', 'sports']);
const CONTACT_OR_FALL = set(['boxing', 'kickboxing', 'martial_arts', 'wrestling', 'football', 'basketball', 'cricket', 'climbing', 'skiing', 'ice_skating', 'cycling', 'hiking', 'sports']);
const HEAVY_LOAD = set(['weightlifting', 'gym_strength', 'climbing', 'rowing', 'wrestling']);
const WATER = set(['swimming', 'kayaking']);
const HEIGHT_OR_BALANCE = set(['climbing', 'hiking', 'skiing', 'ice_skating', 'cycling']);
const HEAD_DOWN = set(['yoga', 'pilates']);
const GENTLE = set(['stretching_mobility', 'slow_walk', 'yoga', 'walking', 'pilates']);

// Body part -> activities that load it, and how the user may name it.
const BODY_PARTS = {
    knee: { re: /knee|ghutn|\bacl\b|menisc|patell|ligament/i, en: 'knee', hi: 'ghutne',
        loads: set(['running', 'jump_rope', 'hiit', 'basketball', 'football', 'badminton', 'squash', 'tennis', 'volleyball', 'hiking', 'skiing', 'dancing', 'zumba', 'wrestling', 'martial_arts', 'kickboxing', 'sports']),
        en_alt: 'swimming, easy cycling or upper-body work', hi_alt: 'swimming, halki cycling ya upper-body exercise' },
    hip: { re: /\bhip\b|hip joint|kooh/i, en: 'hip', hi: 'hip',
        loads: set(['running', 'jump_rope', 'hiit', 'football', 'hiking', 'skiing', 'dancing', 'zumba', 'martial_arts', 'kickboxing', 'wrestling', 'sports']),
        en_alt: 'swimming or seated exercise', hi_alt: 'swimming ya baith ke exercise' },
    back: { re: /back|spine|spinal|disc|sciatica|lumbar|kamar|peeth|slip disc/i, en: 'back', hi: 'kamar',
        loads: set(['weightlifting', 'gym_strength', 'rowing', 'golf', 'kayaking', 'wrestling', 'cricket', 'climbing', 'hiit', 'jump_rope', 'running', 'tennis', 'squash']),
        en_alt: 'walking or swimming', hi_alt: 'walking ya swimming' },
    shoulder: { re: /shoulder|rotator|kandh/i, en: 'shoulder', hi: 'kandhe',
        loads: set(['swimming', 'tennis', 'badminton', 'volleyball', 'cricket', 'weightlifting', 'gym_strength', 'climbing', 'rowing', 'kayaking', 'boxing', 'kickboxing', 'squash', 'pickleball', 'table_tennis', 'basketball', 'wrestling']),
        en_alt: 'walking, cycling or lower-body work', hi_alt: 'walking, cycling ya lower-body exercise' },
    ankle: { re: /ankle|\bfoot\b|\bfeet\b|heel|plantar|achilles|\bpair\b|\bedi\b|takhn/i, en: 'ankle / foot', hi: 'pair / takhne',
        loads: set(['running', 'jump_rope', 'hiit', 'basketball', 'football', 'badminton', 'tennis', 'squash', 'hiking', 'dancing', 'zumba', 'volleyball', 'skiing', 'ice_skating', 'sports', 'walking']),
        en_alt: 'cycling, swimming or upper-body work', hi_alt: 'cycling, swimming ya upper-body exercise' },
    wrist: { re: /wrist|elbow|\bhand\b|finger|kalai|kohni/i, en: 'wrist / elbow', hi: 'kalai / kohni',
        loads: set(['boxing', 'kickboxing', 'weightlifting', 'gym_strength', 'climbing', 'tennis', 'badminton', 'cricket', 'table_tennis', 'squash', 'pickleball', 'golf', 'rowing', 'kayaking', 'yoga']),
        en_alt: 'walking, cycling or lower-body work', hi_alt: 'walking, cycling ya lower-body exercise' },
    neck: { re: /neck|cervical|gardan/i, en: 'neck', hi: 'gardan',
        loads: set(['wrestling', 'martial_arts', 'boxing', 'kickboxing', 'weightlifting', 'gym_strength', 'swimming', 'cycling', 'yoga']),
        en_alt: 'walking or light stretching', hi_alt: 'walking ya light stretching' },
};

// ── medicine classes (exercise-relevant only; never a dose) ─────────────────
const MED_CLASSES = {
    nsaid: /ibuprofen|brufen|combiflam|diclofenac|voveran|dynapar|naproxen|naprosyn|aceclofenac|zerodol|hifenac|ketorolac|etoricoxib|nimesulide|\bnise\b|mefenamic|meftal|piroxicam|indomethacin|painkiller|pain killer|dard ki (goli|dawa)/i,
    analgesic: /paracetamol|acetaminophen|crocin|dolo|calpol|tramadol|ultracet|tapentadol/i,
    sedating: /tramadol|tapentadol|codeine|morphine|alprazolam|clonazepam|diazepam|lorazepam|etizolam|zolpidem|pregabalin|gabapentin|amitriptyline/i,
    quinolone: /ciprofloxacin|levofloxacin|ofloxacin|moxifloxacin|norfloxacin|\bcipro\b|levoflox/i,
    hypo: /insulin|glimepiride|gliclazide|glibenclamide|glipizide|amaryl|glycomet-gp|gemer/i,
    betaBlocker: /\w+olol\b|metoprolol|atenolol|propranolol|bisoprolol|carvedilol|nebivolol/i,
    thinner: /warfarin|acitrom|acenocoumarol|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|clopidogrel|ticagrelor|prasugrel|ecosprin|aspirin|blood thinner/i,
    diuretic: /furosemide|lasix|torsemide|hydrochlorothiazide|chlorthalidone|indapamide|spironolactone|aldactone|diuretic/i,
};

const SYMPTOM = {
    redFlag: /chest|breathless|short(ness)? of breath|saans|palpitat|dhadkan|heart racing|dizz|chakkar|faint|behosh|black ?out/i,
    fever: /fever|bukhar|\bflu\b|viral|covid|chills|thand lag/i,
    stomach: /diarrh|loose motion|dast|vomit|ulti|food poison/i,
};

// ── facts from the profile (built once per check) ───────────────────────────
function exerciseFacts(hp, { symptoms = [], age } = {}) {
    const p = hp || {};
    const c = buildSafetyConstraints(p, { age });
    const meds = ((p.medications && p.medications.items) || []).filter((m) => m && m.active !== false).map((m) => String(m.name || '').trim()).filter(Boolean);
    const med = {};
    for (const [cls, re] of Object.entries(MED_CLASSES)) {
        const hit = meds.find((m) => re.test(m));
        if (hit) med[cls] = hit;
    }
    const d = p.diabetes || {};
    if (!med.hypo && (d.medicationType || []).some((t) => /insulin|sulfonyl/i.test(t))) med.hypo = 'insulin';
    const disabilities = ((p.disabilities && p.disabilities.items) || []).map((x) => String(x.name || '').trim()).filter(Boolean);
    const ageNow = Number(age ?? (p.basic && p.basic.age)) || null;
    return {
        conditions: new Set(c.conditionKeys),
        injuries: c.exercise.injuries.map(String),
        disabilities,
        med,
        diabetesUncontrolled: d.status === 'Uncontrolled',
        age: ageNow,
        symptoms: symptoms.map((s) => String(s.name || s).trim()).filter(Boolean),
    };
}

function activityTraits({ activityType, intensity, duration }) {
    const id = activityType;
    const met = MET_VALUES[id] || 4;
    const mins = Number(duration) || 0;
    return {
        id,
        label: ACTIVITY_LABEL[id] || 'this workout',
        met,
        category: ACTIVITY_CATEGORY[id] || 'other',
        vigorous: intensity === 'high' || (met >= 6 && intensity !== 'low'),
        long: mins >= 60,
        highImpact: HIGH_IMPACT.has(id),
        contact: CONTACT_OR_FALL.has(id),
        heavy: HEAVY_LOAD.has(id),
        water: WATER.has(id),
        height: HEIGHT_OR_BALANCE.has(id),
        headDown: HEAD_DOWN.has(id),
        gentle: GENTLE.has(id) && intensity !== 'high',
    };
}

// ── rules: when(a, f) -> detail (truthy) | null; text(a, f, d) -> { english, hinglish }
const RULES = [
    { code: 'symptom_red_flag', level: 'important',
        when: (a, f) => f.symptoms.find((s) => SYMPTOM.redFlag.test(s)),
        text: (a, f, s) => ({
            english: `You told me about ${s} recently. No (more) workout today; rest. If it comes with exercise or keeps coming back, see a doctor; chest pain with sweating or breathlessness, call 112.`,
            hinglish: `Aapne haal hi mein ${s} bataya tha. Aaj (aur) workout mat kijiye, aaram kijiye. Agar exercise mein ya baar-baar ho raha hai to doctor ko dikhaiye; seene mein dard ke saath pasina ya saans phoole to 112 call kijiye.`,
        }) },
    { code: 'symptom_fever', level: 'important',
        when: (a, f) => !a.gentle && f.symptoms.find((s) => SYMPTOM.fever.test(s)),
        text: (a, f, s) => ({
            english: `You have ${s} on record. Exercising with a fever strains the heart; rest until you are 24 hours fever-free, then restart light.`,
            hinglish: `Aapke record mein ${s} hai. Bukhar mein exercise dil pe zor daalti hai; bukhar utarne ke 24 ghante baad halke se shuru kijiye.`,
        }) },
    { code: 'symptom_stomach', level: 'caution',
        when: (a, f) => (a.vigorous || a.long) && f.symptoms.find((s) => SYMPTOM.stomach.test(s)),
        text: (a, f, s) => ({
            english: `With ${s} you lose water fast. Keep it light today and drink ORS / water before and after.`,
            hinglish: `${s} mein body se paani jaldi nikalta hai. Aaj halka rakhiye aur pehle-baad ORS / paani pijiye.`,
        }) },
    { code: 'heart_vigorous', level: 'important',
        when: (a, f) => f.conditions.has('heart') && a.vigorous,
        text: () => ({
            english: 'Your profile has a heart condition, and this is a high-intensity workout. Do it only if your cardiologist has cleared this level; stop at chest pain, breathlessness or dizziness.',
            hinglish: 'Aapke profile mein heart condition hai aur ye high-intensity workout hai. Ye tabhi kijiye jab cardiologist ne is level ki permission di ho; seene mein dard, saans phoolna ya chakkar aaye to turant ruk jaiye.',
        }) },
    { code: 'epilepsy_water_height', level: 'important',
        when: (a, f) => f.conditions.has('epilepsy') && (a.water || a.height),
        text: (a) => ({
            english: `With epilepsy, ${a.label.toLowerCase()} is risky alone. Do it only with someone who knows, or a lifeguard / partner right next to you.`,
            hinglish: `Epilepsy ke saath ${a.label.toLowerCase()} akele risky hai. Kisi ke saath kijiye jo jaanta ho, ya lifeguard / partner paas mein ho.`,
        }) },
    { code: 'painkiller_kidney', level: 'important',
        when: (a, f) => f.med.nsaid && f.conditions.has('kidney') && (a.vigorous || a.long),
        text: (a, f) => ({
            english: `You take ${f.med.nsaid} (a painkiller) and have a kidney condition. A hard or long workout with it is extra load on the kidneys; ask your doctor before, keep it moderate and drink water as your doctor advised.`,
            hinglish: `Aap ${f.med.nsaid} (painkiller) lete hain aur kidney condition bhi hai. Iske saath hard ya lamba workout kidney pe extra load hai; pehle doctor se poochiye, moderate rakhiye aur doctor ke bataye hisaab se paani pijiye.`,
        }) },
    { code: 'painkiller', level: 'caution',
        when: (a, f) => !f.conditions.has('kidney') && f.med.nsaid && (a.vigorous || a.long || a.highImpact || f.injuries.length),
        text: (a, f) => ({
            english: `You take ${f.med.nsaid} (a painkiller). It can hide pain, so an injury can get worse without you noticing, and a hard workout with little water is tough on the kidneys. Keep it moderate, drink water, and stop at any sharp pain.`,
            hinglish: `Aap ${f.med.nsaid} (painkiller) lete hain. Ye dard chhupa deti hai, to chot badh sakti hai bina pata chale, aur kam paani ke saath hard workout kidney pe bhaari padta hai. Moderate rakhiye, paani pijiye, aur tez dard ho to ruk jaiye.`,
        }) },
    { code: 'pain_masking', level: 'caution',
        when: (a, f) => !f.med.nsaid && f.med.analgesic && (a.highImpact || a.heavy || f.injuries.length),
        text: (a, f) => ({
            english: `You take ${f.med.analgesic} for pain. It can hide the warning pain of an injury; go easier than usual and stop if something hurts.`,
            hinglish: `Aap dard ke liye ${f.med.analgesic} lete hain. Ye chot ka warning dard chhupa sakti hai; normal se halka kijiye aur kuch dard kare to ruk jaiye.`,
        }) },
    { code: 'injury_load', level: 'caution',
        when: (a, f) => {
            const sources = [...f.injuries, ...f.symptoms.filter((s) => /pain|dard|sprain|swelling|sujan|injur|chot/i.test(s))];
            for (const src of sources) {
                for (const part of Object.values(BODY_PARTS)) {
                    if (part.re.test(src) && part.loads.has(a.id)) return { src, part };
                }
            }
            return null;
        },
        text: (a, f, { src, part }) => ({
            english: `Your profile lists "${src}", and ${a.label.toLowerCase()} puts load on the ${part.en}. Go gentle and stop if it hurts; ${part.en_alt} is easier on it.`,
            hinglish: `Aapke profile mein "${src}" hai, aur ${a.label.toLowerCase()} se ${part.hi} pe load padta hai. Halke se kijiye aur dard ho to ruk jaiye; ${part.hi_alt} isme aasaan rahega.`,
        }) },
    { code: 'injury_general', level: 'caution',
        when: (a, f) => (a.highImpact || a.heavy) && f.injuries.find((i) => !Object.values(BODY_PARTS).some((p) => p.re.test(i))),
        text: (a, f, src) => ({
            english: `Your profile lists "${src}". ${a.label} is high-load; keep it gentle and stop if it hurts.`,
            hinglish: `Aapke profile mein "${src}" hai. ${a.label} mein load zyada hai; halka rakhiye aur dard ho to ruk jaiye.`,
        }) },
    { code: 'hypo_risk', level: 'caution',
        when: (a, f) => f.med.hypo && (a.vigorous || a.long),
        text: (a, f) => ({
            english: `With ${f.med.hypo}, a hard or long workout can drop your sugar. Eat something 1-2 hours before, keep glucose or a sweet handy, and check sugar before if you have a meter.`,
            hinglish: `${f.med.hypo} ke saath hard ya lamba workout sugar gira sakta hai. 1-2 ghante pehle kuch khaiye, glucose ya meetha paas rakhiye, aur meter ho to pehle sugar check kijiye.`,
        }) },
    { code: 'diabetes_uncontrolled', level: 'caution',
        when: (a, f) => f.diabetesUncontrolled && a.vigorous,
        text: () => ({
            english: 'Your diabetes is marked uncontrolled. Check sugar before a hard workout; if it is above 250 mg/dL, keep it to a light walk today.',
            hinglish: 'Aapki diabetes uncontrolled mark hai. Hard workout se pehle sugar check kijiye; 250 mg/dL se upar ho to aaj sirf halki walk.',
        }) },
    { code: 'bp_strain', level: 'caution',
        when: (a, f) => f.conditions.has('hypertension') && (a.heavy || a.met >= 8),
        text: () => ({
            english: 'You have high BP. No breath-holding or very heavy lifts; keep it moderate and breathe out on the effort.',
            hinglish: 'Aapko high BP hai. Saans rok ke bhaari weight mat uthaiye; moderate rakhiye aur zor lagate waqt saans chhodiye.',
        }) },
    { code: 'beta_blocker', level: 'caution',
        when: (a, f) => f.med.betaBlocker && a.vigorous && a.category === 'cardio',
        text: (a, f) => ({
            english: `${f.med.betaBlocker} keeps your heart rate lower, so heart-rate zones under-read your effort. Use the talk test instead: you should still be able to speak in short sentences.`,
            hinglish: `${f.med.betaBlocker} heart rate kam rakhti hai, to HR zones aapki mehnat kam dikhayenge. Talk test use kijiye: chhote sentence bol paane chahiye.`,
        }) },
    { code: 'blood_thinner', level: 'caution',
        when: (a, f) => f.med.thinner && a.contact,
        text: (a, f) => ({
            english: `You take ${f.med.thinner} (blood thinner). In ${a.label.toLowerCase()} a fall or knock bleeds and bruises more; wear protection, and see a doctor after any head hit.`,
            hinglish: `Aap ${f.med.thinner} (blood thinner) lete hain. ${a.label} mein girne ya chot lagne pe khoon zyada behta hai; protection pehniye, aur sir pe chot lage to doctor ko dikhaiye.`,
        }) },
    { code: 'quinolone_tendon', level: 'caution',
        when: (a, f) => f.med.quinolone && (a.heavy || a.highImpact || a.vigorous),
        text: (a, f) => ({
            english: `${f.med.quinolone} (antibiotic) can weaken tendons. Avoid heavy, jumping or sprinting work until the course is over; stop at any heel or calf pain.`,
            hinglish: `${f.med.quinolone} (antibiotic) tendons kamzor kar sakti hai. Course khatam hone tak bhaari, jumping ya sprint wala workout avoid kijiye; edi ya pindli mein dard ho to ruk jaiye.`,
        }) },
    { code: 'sedating_med', level: 'caution',
        when: (a, f) => f.med.sedating && (a.water || a.height || a.heavy),
        text: (a, f) => ({
            english: `${f.med.sedating} can make you drowsy or unsteady. Be careful with ${a.label.toLowerCase()}; don't do it alone.`,
            hinglish: `${f.med.sedating} se neend ya chakkar jaisa lag sakta hai. ${a.label} mein dhyan rakhiye; akele mat kijiye.`,
        }) },
    { code: 'diuretic_fluids', level: 'caution',
        when: (a, f) => f.med.diuretic && (a.long || a.vigorous),
        text: (a, f) => ({
            english: `${f.med.diuretic} makes you lose more water. Sip water through the workout and stop if you get cramps or feel dizzy.`,
            hinglish: `${f.med.diuretic} se body se paani zyada nikalta hai. Workout ke beech paani pite rahiye aur cramp ya chakkar aaye to ruk jaiye.`,
        }) },
    { code: 'asthma', level: 'caution',
        when: (a, f) => f.conditions.has('asthma') && a.vigorous,
        text: () => ({
            english: 'You have asthma. Warm up slowly, keep your inhaler with you, and avoid cold or polluted air.',
            hinglish: 'Aapko asthma hai. Dheere warm-up kijiye, inhaler paas rakhiye, aur thandi ya pollution wali hawa mein mat kijiye.',
        }) },
    { code: 'joints_impact', level: 'caution',
        when: (a, f) => f.conditions.has('joints') && a.highImpact,
        text: () => ({
            english: 'Your profile has a joint problem, and this is high-impact. Low-impact options (walking, cycling, swimming) are kinder on the joints.',
            hinglish: 'Aapke profile mein joints ki problem hai aur ye high-impact hai. Walking, cycling, swimming jaise low-impact options joints ke liye behtar hain.',
        }) },
    { code: 'bone_density', level: 'caution',
        when: (a, f) => f.conditions.has('osteoporosis') && (a.highImpact || a.contact || a.heavy),
        text: () => ({
            english: 'With low bone density, falls and heavy impact can cause fractures. Prefer walking and light strength work.',
            hinglish: 'Low bone density mein girna ya zor ka impact fracture kar sakta hai. Walking aur light strength exercise behtar hai.',
        }) },
    { code: 'hernia_strain', level: 'caution',
        when: (a, f) => f.conditions.has('hernia') && a.heavy,
        text: () => ({
            english: 'With a hernia, heavy lifting and straining push on it. Keep weights light and never hold your breath while lifting.',
            hinglish: 'Hernia mein bhaari weight aur zor lagana usko badhata hai. Weight halka rakhiye aur uthate waqt saans mat rokiye.',
        }) },
    { code: 'eye_strain', level: 'caution',
        when: (a, f) => f.conditions.has('eye') && (a.heavy || a.headDown || a.contact),
        text: () => ({
            english: 'Your eye condition gets worse with straining, head-down poses and knocks. Skip heavy lifts, inversions and contact play.',
            hinglish: 'Aapki eye condition zor lagane, sir neeche wale poses aur chot se bigad sakti hai. Bhaari weight, ulte poses aur contact games avoid kijiye.',
        }) },
    { code: 'kidney_hard', level: 'caution',
        when: (a, f) => !f.med.nsaid && f.conditions.has('kidney') && a.vigorous && a.long,
        text: () => ({
            english: 'With a kidney condition, keep long hard sessions moderate and drink water the way your doctor advised.',
            hinglish: 'Kidney condition mein lambe hard session moderate rakhiye aur paani doctor ke bataye hisaab se pijiye.',
        }) },
    { code: 'anaemia', level: 'caution',
        when: (a, f) => f.conditions.has('anaemia') && a.vigorous,
        text: () => ({
            english: 'With anaemia you tire and get breathless sooner. Go lighter and stop if you feel dizzy.',
            hinglish: 'Anaemia mein thakan aur saans jaldi phoolti hai. Halka rakhiye aur chakkar aaye to ruk jaiye.',
        }) },
    { code: 'disability_adapt', level: 'caution',
        when: (a, f) => f.disabilities.length && (a.highImpact || a.height || a.water || a.contact) && f.disabilities.join(', '),
        text: (a, f, d) => ({
            english: `Your profile lists ${d}. Use an adapted version of ${a.label.toLowerCase()} that fits you, ideally with someone around.`,
            hinglish: `Aapke profile mein ${d} hai. ${a.label} ka aisa adapted version kijiye jo aapke liye safe ho, aur ho sake to kisi ke saath.`,
        }) },
    { code: 'older_adult', level: 'caution',
        when: (a, f) => f.age >= 65 && (a.highImpact || a.contact || a.met >= 8),
        text: () => ({
            english: 'At 65+, high-impact work raises the risk of falls and joint injury. A longer warm-up, low-impact options and balance work are safer.',
            hinglish: '65+ umar mein high-impact se girne aur joints ki chot ka risk badhta hai. Lamba warm-up, low-impact options aur balance exercise zyada safe hain.',
        }) },
    { code: 'teen_heavy', level: 'caution',
        when: (a, f) => f.age && f.age < 16 && a.heavy,
        text: () => ({
            english: 'At your age, focus on technique with light weights and a trainer around; no max lifts.',
            hinglish: 'Is umar mein light weight ke saath technique pe dhyan dijiye, trainer ke saath; max weight mat uthaiye.',
        }) },
];

const LEVEL_RANK = { important: 0, caution: 1 };

function checkExercise(activity, facts) {
    if (!activity || !activity.activityType || !facts) return [];
    const a = activityTraits(activity);
    const out = [];
    for (const r of RULES) {
        let d;
        try { d = r.when(a, facts); } catch { d = null; }
        if (!d) continue;
        out.push({ code: r.code, level: r.level, text: r.text(a, facts, d) });
    }
    // A red-flag symptom says "skip today": the other tips would contradict it.
    if (out.some((x) => x.code === 'symptom_red_flag')) return out.filter((x) => x.code === 'symptom_red_flag');
    return out.sort((x, y) => LEVEL_RANK[x.level] - LEVEL_RANK[y.level]);
}

module.exports = { checkExercise, exerciseFacts, activityTraits, RULES, MED_CLASSES, BODY_PARTS };
