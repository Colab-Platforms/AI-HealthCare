// Deterministic routing: which specialists a message needs, from keywords
// (English + Hinglish), independent of the model. Two uses:
//   1. prefetch: start these specialists BEFORE the classifier answers (DB
//      reads are cheap, the model call is the slow part);
//   2. safety net: always added to whatever the classifier picked, so e.g.
//      "tired" always looks at sleep even if the model forgets.
// Each rule lists the specialists, topics and a reason (logged in tests).

const RULES = [
    {
        name: 'fatigue',
        re: /\b(tired|tiredness|fatigue|fatigued|exhausted|low energy|no energy|drained|lethargic|sleepy|drowsy|weak(ness)?|thak(a|i|an|aan|aa hua|i hui)|thakaan|kamzori|sust|neend aa rahi)\b/i,
        specialists: ['sleep', 'recovery'],
        topics: ['recovery', 'sleep'],
    },
    {
        name: 'training decision',
        re: /\b(gym|workout|work out|exercise|train(ing)?|lift(ing)?|weights|run(ning)?|jog(ging)?|cardio|hiit|yoga|cycling|swim(ming)?|sports?|match|rest day|kasrat|vyayam)\b/i,
        specialists: ['recovery', 'fitness'],
        topics: ['fitness', 'recovery'],
    },
    {
        name: 'sleep',
        re: /\b(sleep|slept|sleeping|insomnia|nap|woke up|waking up|wake up|bedtime|night shift|neend|soya|soyi|so (nahi|nhi) pa(ya|yi|ta|ti)|raat ko)\b/i,
        specialists: ['sleep', 'recovery'],
        topics: ['sleep'],
    },
    {
        name: 'soreness / body pain',
        re: /\b(sore(ness)?|doms|muscle pain|body ache|body pain|stiff(ness)?|cramp|badan dard|muscles? (me|mein) dard)\b/i,
        specialists: ['recovery', 'fitness'],
        topics: ['recovery', 'fitness'],
    },
    {
        name: 'stress / mood',
        re: /\b(stress(ed)?|anxious|anxiety|tension|overwhelmed|burn(ed|t)? ?out|irritable|mood|pareshan|chinta|tension (hai|ho))\b/i,
        specialists: ['recovery', 'sleep'],
        topics: ['stress', 'sleep'],
    },
    {
        name: 'food / diet',
        re: /\b(eat|ate|eating|food|meal|diet|breakfast|lunch|dinner|snack|calories?|kcal|protein|carbs?|fat|fiber|sugar intake|junk|cheat meal|kha(na|ana|un|u|ye|ya|yi|ta|ti)|khaana|nasht(a|e)|roti|chawal|rice|dal|paneer|fruit|craving)\b/i,
        specialists: ['nutrition'],
        topics: ['nutrition'],
    },
    {
        name: 'weight change',
        re: /\b(lose weight|weight loss|lose fat|fat loss|gain weight|weight gain|bulk(ing)?|cut(ting)?|my weight|weigh|belly fat|vajan|wajan|motapa)\b/i,
        specialists: ['nutrition', 'fitness'],
        topics: ['nutrition', 'fitness'],
    },
    {
        name: 'hydration',
        re: /\b(water|hydrat\w*|dehydrat\w*|thirsty|pani|paani)\b/i,
        specialists: ['nutrition'],
        topics: ['nutrition'],
    },
    {
        name: 'lab report',
        re: /\b(report|lab|blood test|test result|hba1c|cholesterol|lipid|ldl|hdl|triglyceride|vitamin ?(d|b12)|b12|iron|ferritin|hemoglobin|haemoglobin|thyroid|tsh|t3|t4|creatinine|uric acid|liver|kidney|cbc|platelet)\b/i,
        specialists: ['medical_lab'],
        topics: ['medical_lab'],
    },
    {
        name: 'blood sugar',
        re: /\b(sugar|glucose|diabet\w*|insulin|spike|madhumeh)\b/i,
        specialists: ['nutrition', 'medical_lab'],
        topics: ['nutrition', 'medical_lab'],
    },
    {
        name: 'heart / readiness numbers',
        re: /\b(hrv|heart rate|resting heart|rhr|pulse|readiness|recovery score|recovery)\b/i,
        specialists: ['recovery'],
        topics: ['recovery'],
    },
    {
        name: 'activity / steps',
        re: /\b(steps?|walk(ing|ed)?|activity|activities|active|active minutes|sedentary|sitting all day|chal(na|a|i)|movement)\b/i,
        specialists: ['fitness'],
        topics: ['fitness'],
    },
    {
        name: 'supplements',
        re: /\b(supplements?|multivitamin|whey|protein powder|creatine|omega|fish oil|vitamin tablets?|capsules?|should i (take|start)|can i take|(le|lu|loon|lun|khau|khaun) kya|kya (main )?(le|lu|loon|lun))\b/i,
        specialists: ['medical_lab'],
        topics: ['supplements'],
    },
    {
        name: 'headache',
        re: /\b(headache|head ache|migraine|sir dard|sar dard)\b/i,
        specialists: ['sleep', 'nutrition'],
        topics: ['sleep', 'nutrition'],
    },
    {
        name: 'progress overview',
        re: /\b(how am i doing|my progress|overall|this week|last week|this month|last month|summary|report card|kaisa chal raha|progress kaisi)\b/i,
        specialists: ['sleep', 'recovery', 'fitness', 'nutrition', 'progress'],
        topics: ['general'],
    },
    {
        name: 'improvement / goals',
        re: /\b(improv\w*|better than|worse than|compar\w*|trend|on track|progress|goals?|targets?|consistent|consistency|sudhar|behtar|badh raha|ghat raha|imporve)\b/i,
        specialists: ['progress'],
        topics: ['general'],
    },
];

/**
 * @returns { specialists: string[], topics: string[], matched: string[] }
 */
function applyRoutingRules(message) {
    const text = String(message || '');
    const specialists = new Set();
    const topics = new Set();
    const matched = [];
    for (const rule of RULES) {
        if (!rule.re.test(text)) continue;
        matched.push(rule.name);
        rule.specialists.forEach((s) => specialists.add(s));
        rule.topics.forEach((t) => topics.add(t));
    }
    return { specialists: [...specialists], topics: [...topics], matched };
}

// Classifier output + rules, as a union (rules never remove what the model chose).
function mergeRouting(classification, message) {
    const rules = applyRoutingRules(message);
    if (['greeting', 'thanks'].includes(classification.intent)) return { ...classification, ruleMatches: [] };
    return {
        ...classification,
        specialists: [...new Set([...(classification.specialists || []), ...rules.specialists])],
        topics: [...new Set([...(classification.topics || []).filter((t) => t !== 'general' || !rules.topics.length), ...rules.topics])],
        ruleMatches: rules.matched,
    };
}

module.exports = { applyRoutingRules, mergeRouting, ROUTING_RULES: RULES };
