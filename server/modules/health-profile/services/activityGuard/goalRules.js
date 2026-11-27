// Goal x health profile rules (27 Nov). Pure. Runs when the user sets or
// changes their HealthGoal: the goal is saved as asked (the pace has its own
// consent step already); these only add what the profile says about it.
//
//   checkGoal(goal, hp) -> [{ code, level, text: { english, hinglish } }]
//   goal: { goalType, currentWeight, targetWeight, height, age, weeklyRateKg, dailyCalorieTarget, gender }

const { buildSafetyConstraints } = require('../safetyConstraints');

const LOSS = new Set(['weight_loss']);
const GAIN = new Set(['weight_gain', 'muscle_gain']);
const HYPO = /insulin|glimepiride|gliclazide|glibenclamide|glipizide|amaryl/i;
const EATING_DISORDER = /eating disorder|anorexi|bulimi|binge|arfid/i;

function goalFacts(hp, goal) {
    const p = hp || {};
    const c = buildSafetyConstraints(p);
    const meds = ((p.medications && p.medications.items) || []).filter((m) => m && m.active !== false).map((m) => String(m.name || ''));
    const d = p.diabetes || {};
    const hypo = meds.find((m) => HYPO.test(m)) || ((d.medicationType || []).some((t) => /insulin|sulfonyl/i.test(t)) ? 'insulin' : null);
    const mental = ((p.mentalHealth && p.mentalHealth.items) || []).map((m) => String(m.name || '')).join(' | ');
    const height = Number(goal.height) || Number(p.body && p.body.heightCm) || 0;
    const age = Number(goal.age) || Number(p.basic && p.basic.age) || 0;
    return { conditions: new Set(c.conditionKeys), hypo, eatingDisorder: EATING_DISORDER.test(mental), height, age };
}

const bmi = (kg, cm) => (kg > 0 && cm > 0 ? kg / ((cm / 100) ** 2) : null);

const RULES = [
    { code: 'goal_eating_disorder', level: 'important',
        when: (g, f) => LOSS.has(g.goalType) && f.eatingDisorder,
        text: () => ({
            english: 'Your profile mentions an eating disorder. Weight-loss targets can make it worse; please set this goal together with your doctor or therapist. I\'ll keep the focus on regular, balanced meals.',
            hinglish: 'Aapke profile mein eating disorder hai. Weight-loss target ise badha sakta hai; ye goal apne doctor ya therapist ke saath set kijiye. Main regular, balanced khaane pe focus rakhunga.',
        }) },
    { code: 'goal_underweight_target', level: 'important',
        when: (g, f) => LOSS.has(g.goalType) && (bmi(Number(g.targetWeight), f.height) ?? 99) < 18.5 && Math.round(bmi(Number(g.targetWeight), f.height) * 10) / 10,
        text: (g, f, b) => ({
            english: `A target of ${g.targetWeight} kg is a BMI of about ${b}, which is underweight for your height. A target at BMI 18.5 or above is safer.`,
            hinglish: `${g.targetWeight} kg ka target lagbhag ${b} BMI hai, jo aapki height ke hisaab se underweight hai. 18.5 ya usse upar BMI wala target zyada safe hai.`,
        }) },
    { code: 'goal_teen_loss', level: 'caution',
        when: (g, f) => LOSS.has(g.goalType) && f.age > 0 && f.age < 18,
        text: () => ({
            english: 'Your body is still growing, so big calorie cuts are not safe. Focus on activity and fewer junk foods, and check the goal with a doctor or dietitian.',
            hinglish: 'Aapki body abhi grow kar rahi hai, isliye zyada calorie kaatna safe nahi. Activity badhaiye aur junk kam kijiye, aur goal doctor ya dietitian se check karwaiye.',
        }) },
    { code: 'goal_hypo_meds', level: 'caution',
        when: (g, f) => LOSS.has(g.goalType) && f.hypo,
        text: (g, f) => ({
            english: `Eating less while on ${f.hypo} can drop your sugar, and the dose may need changing as you lose weight. Tell your doctor about this goal and check sugar more often.`,
            hinglish: `${f.hypo} ke saath kam khaane se sugar gir sakti hai, aur weight kam hone pe dose badalni pad sakti hai. Doctor ko is goal ke baare mein bataiye aur sugar zyada baar check kijiye.`,
        }) },
    { code: 'goal_fast_with_condition', level: 'caution',
        when: (g, f) => LOSS.has(g.goalType) && Number(g.weeklyRateKg) >= 0.75 && ['diabetes', 'heart', 'kidney'].find((k) => f.conditions.has(k)),
        text: (g, f, k) => ({
            english: `With ${{ diabetes: 'diabetes', heart: 'a heart condition', kidney: 'a kidney condition' }[k]}, about ${g.weeklyRateKg} kg a week is fast. 0.25-0.5 kg a week is safer and easier to keep.`,
            hinglish: `${{ diabetes: 'Diabetes', heart: 'Heart condition', kidney: 'Kidney condition' }[k]} ke saath ${g.weeklyRateKg} kg har hafte tez hai. 0.25-0.5 kg har hafta zyada safe aur tikau hai.`,
        }) },
    { code: 'goal_older_loss', level: 'caution',
        when: (g, f) => LOSS.has(g.goalType) && f.age >= 65,
        text: () => ({
            english: 'At 65+, losing weight can also lose muscle. Keep protein in every meal and add light strength work 2-3 times a week.',
            hinglish: '65+ umar mein weight ke saath muscle bhi ghat sakti hai. Har meal mein protein rakhiye aur hafte mein 2-3 baar light strength exercise kijiye.',
        }) },
    { code: 'goal_kidney_protein', level: 'caution',
        when: (g, f) => GAIN.has(g.goalType) && f.conditions.has('kidney'),
        text: () => ({
            english: 'Gain / muscle goals usually mean more protein, but with a kidney condition protein must stay at what your doctor advised. Please check this goal with them.',
            hinglish: 'Gain / muscle goal mein aam taur pe protein zyada hota hai, par kidney condition mein protein utna hi jitna doctor ne bataya. Ye goal unse check karwaiye.',
        }) },
    { code: 'goal_very_low_calories', level: 'caution',
        when: (g) => Number(g.dailyCalorieTarget) > 0 && Number(g.dailyCalorieTarget) < (g.gender === 'male' ? 1500 : 1200) && Math.round(Number(g.dailyCalorieTarget)),
        text: (g, f, kcal) => ({
            english: `${kcal} kcal a day is very low and hard to get enough nutrients from. A slower pace gives a higher, safer target.`,
            hinglish: `${kcal} kcal roz bahut kam hai, isme poore nutrients milna mushkil hai. Dheemi pace se target zyada aur safe ho jaayega.`,
        }) },
];

function checkGoal(goal, hp) {
    if (!goal || !goal.goalType) return [];
    const f = goalFacts(hp, goal);
    const out = [];
    for (const r of RULES) {
        let d;
        try { d = r.when(goal, f); } catch { d = null; }
        if (d) out.push({ code: r.code, level: r.level, text: r.text(goal, f, d) });
    }
    const rank = { important: 0, caution: 1 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

module.exports = { checkGoal, RULES };
