/**
 * Deterministic routing rules against messages real users send (English +
 * Hinglish). Each case lists the specialists that MUST run; extra ones are
 * allowed (a cheap DB read), missing ones are the bug.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { applyRoutingRules, mergeRouting } = require('../modules/ai-coach/orchestrator/routingRules');

const CASES = [
    // tired / energy (sleep is the #1 cause, recovery the #2)
    ["I'm feeling tired today, and I've to go to the gym today", ['sleep', 'recovery', 'fitness']],
    ['why do I feel so exhausted every afternoon?', ['sleep', 'recovery']],
    ['aaj bahut thakan hai', ['sleep', 'recovery']],
    ['body mein kamzori lag rahi hai', ['sleep', 'recovery']],
    ['no energy since 3 days', ['sleep', 'recovery']],
    // training decisions
    ['should I train legs today or take a rest day?', ['recovery', 'fitness']],
    ['can I do HIIT today?', ['recovery', 'fitness']],
    ['kya aaj gym jaun?', ['recovery', 'fitness']],
    ['planning a 10k run tomorrow morning', ['recovery', 'fitness']],
    // sleep
    ['how did I sleep last night?', ['sleep']],
    ['I keep waking up at 3am', ['sleep']],
    ['raat ko neend nahi aati', ['sleep']],
    // soreness
    ['my legs are so sore after yesterday', ['recovery', 'fitness']],
    ['badan dard ho raha hai workout ke baad', ['recovery', 'fitness']],
    // stress
    ['work stress is killing me, feeling anxious', ['recovery', 'sleep']],
    ['bahut tension hai aaj kal', ['recovery', 'sleep']],
    // food
    ['what should I eat for dinner?', ['nutrition']],
    ['how much protein did I have today?', ['nutrition']],
    ['nashte mein kya khaun?', ['nutrition']],
    ['is paneer good for me?', ['nutrition']],
    // weight
    ['I want to lose weight fast', ['nutrition', 'fitness']],
    ['vajan kam karna hai', ['nutrition', 'fitness']],
    // hydration
    ['am I drinking enough water?', ['nutrition']],
    ['paani kitna peena chahiye?', ['nutrition']],
    // labs
    ['what does my vitamin D report say?', ['medical_lab']],
    ['is my HbA1c okay?', ['medical_lab']],
    ['my cholesterol was high, what should I do', ['medical_lab']],
    // sugar
    ['will rice spike my sugar?', ['nutrition', 'medical_lab']],
    // readiness numbers
    ['why is my HRV low today?', ['recovery']],
    ['what is my recovery score?', ['recovery']],
    // activity
    ['how many steps did I walk this week?', ['fitness']],
    ['bhai mera ye week se bata ki Activity ka status kya hai imporve ho raha hai ki nai?', ['fitness']], // missed in the 24 Nov run
    // supplements
    ['should I take creatine?', ['medical_lab']],
    // headache
    ['sir dard ho raha hai subah se', ['sleep', 'nutrition']],
    // overview
    ['how am I doing this week?', ['sleep', 'recovery', 'fitness', 'nutrition']],
    ['meri progress kaisi chal rahi hai is month?', ['sleep', 'recovery', 'fitness', 'nutrition']],
];

test('routing: every real-user message gets at least the specialists it needs', () => {
    const misses = [];
    for (const [msg, needed] of CASES) {
        const got = applyRoutingRules(msg).specialists;
        const missing = needed.filter((s) => !got.includes(s));
        if (missing.length) misses.push(`"${msg}" missing ${missing.join(', ')} (got ${got.join(', ') || 'none'})`);
    }
    assert.deepEqual(misses, []);
});

test('routing: small talk and general knowledge fetch nothing', () => {
    for (const msg of ['hi', 'thank you', 'who are you?', 'tell me a joke', 'what is the capital of France?', 'ok']) {
        assert.deepEqual(applyRoutingRules(msg).specialists, [], msg);
    }
});

test('merge: rules add to the classifier, never remove; greetings untouched', () => {
    const m = mergeRouting({ intent: 'health_coaching', specialists: ['fitness'], topics: ['fitness'] }, "I'm tired, gym today?");
    assert.deepEqual(m.specialists.sort(), ['fitness', 'recovery', 'sleep']);
    assert.ok(m.ruleMatches.includes('fatigue'));
    const g = mergeRouting({ intent: 'greeting', specialists: [], topics: [] }, 'hi, tired');
    assert.deepEqual(g.specialists, []);
    // "general" from the model is dropped once a rule found a real topic
    const t = mergeRouting({ intent: 'other', specialists: [], topics: ['general'] }, 'how did I sleep?');
    assert.ok(!t.topics.includes('general'));
});
