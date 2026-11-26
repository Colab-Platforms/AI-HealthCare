/**
 * Age-aware coaching (25 Nov): the age group and its rules are decided in
 * code and sent with every answer; falls get a safety path; 65+ symptoms are
 * followed up sooner; the app's exercise note (65+: balance) reaches the coach.
 * No DB, no API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { ageBand, ageGuidance } = require('../modules/ai-coach/context/ageGuidance');
const { buildRequest } = require('../modules/ai-coach/response/responseGenerator');
const { computeTargets, formatTargets } = require('../modules/ai-coach/context/targets');
const { checkMessage, cautionLine } = require('../modules/ai-coach/safety/safetyRules');
const { pickCheckIn } = require('../modules/ai-coach/orchestrator/checkIns');

const NOW = new Date('2026-11-25T08:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000);
const dataOf = (req) => req.messages.at(-1).content;

test('ageBand: bands and unknown age', () => {
    assert.equal(ageBand(15), 'teen');
    assert.equal(ageBand(17), 'teen');
    assert.equal(ageBand(18), 'adult');
    assert.equal(ageBand(49), 'adult');
    assert.equal(ageBand(50), 'midlife');
    assert.equal(ageBand(64), 'midlife');
    assert.equal(ageBand(65), 'older');
    assert.equal(ageBand(null), null);
    assert.equal(ageBand(undefined), null);
    assert.equal(ageBand(0), null);
    assert.equal(ageBand('67'), null);
});

test('ageGuidance: rules per group; adult man gets nothing extra', () => {
    assert.equal(ageGuidance({ age: 24, gender: 'male' }), null);
    assert.equal(ageGuidance({}), null);
    const teen = ageGuidance({ age: 16, gender: 'male' }).text;
    assert.match(teen, /never suggest a calorie deficit/);
    assert.match(teen, /No supplements/);
    const mid = ageGuidance({ age: 55, gender: 'male' }).text;
    assert.match(mid, /joint-friendly/);
    assert.ok(!/Woman over 45/.test(mid));
    const older = ageGuidance({ age: 67, gender: 'female' }).text;
    assert.match(older, /Age group: older adult, 65\+ \(age 67\)/);
    assert.match(older, /balance/);
    assert.match(older, /0\.25-0\.5 kg a week/);
    assert.match(older, /Woman over 45/);
    assert.match(ageGuidance({ age: 47, gender: 'female' }).text, /Woman over 45/); // adult band, bone rule alone
    assert.equal(ageGuidance({ age: 44, gender: 'female' }), null);
});

test('buildRequest: 67-year-old gets the age block, 24-year-old does not', () => {
    const older = buildRequest({ message: 'workout plan do', profileContext: { basic: { age: 67, gender: 'female' }, summary: 'x' }, classification: { language: 'hinglish' } });
    assert.match(dataOf(older), /Age group: older adult, 65\+/);
    const young = buildRequest({ message: 'workout plan do', profileContext: { basic: { age: 24, gender: 'male' }, summary: 'x' }, classification: { language: 'hinglish' } });
    assert.ok(!/Age group/.test(dataOf(young)));
    assert.ok(!/Age group/.test(dataOf(buildRequest({ message: 'x', classification: {} }))));
});

test('targets: the app exercise note for 65+ (balance training) reaches the coach', () => {
    const ctx = computeTargets({ user: { profile: { age: 67 }, nutritionGoal: { calorieGoal: 1600 } }, healthGoal: null, dietPlan: null, today: null });
    assert.match(ctx.targets.exerciseNote, /balance/i);
    assert.match(formatTargets(ctx), /App exercise note: .*balance/i);
    const young = computeTargets({ user: { profile: { age: 24 }, nutritionGoal: { calorieGoal: 2500 } }, healthGoal: null, dietPlan: null, today: null });
    assert.ok(!/App exercise note/.test(formatTargets(young)));
});

test('falls: plain fall -> caution; head injury / cannot get up / fracture -> emergency; not-falls ignored', () => {
    for (const m of ['main kal bathroom mein gir gaya tha', 'I slipped in the bathroom', 'seedhi se gir gayi', 'I fell yesterday', 'phisal gaya tha', 'sir pe chot nahi lagi, bas gir gaya', 'slipped, small cut on knee, thoda khoon aaya']) {
        const r = checkMessage(m);
        assert.equal(r.flagged, false, m);
        assert.equal(r.caution?.kind, 'fall', m);
    }
    for (const m of ['gir gaya aur sir pe chot lagi', 'I fell and hit my head', 'gir gayi hoon, uth nahi pa rahi', 'fell and can\'t get up', 'gir gaya, lagta hai haddi toot gayi', 'slipped and the bleeding won\'t stop']) {
        const r = checkMessage(m);
        assert.equal(r.flagged, true, m);
        assert.equal(r.kind, 'emergency', m);
    }
    for (const m of ['mera weight 2 kg gir gaya', 'sugar level gir gaya tha', 'I fell asleep late', 'my steps fell this week', 'gym jaun?']) {
        const r = checkMessage(m);
        assert.equal(r.flagged, false, m);
        assert.ok(!r.caution, m);
    }
});

test('fall caution: own fixed line and its own data instruction (not the chest-pain one)', () => {
    assert.match(cautionLine({ kind: 'fall' }, { language: 'hinglish' }), /sir pe chot/);
    assert.match(cautionLine({ kind: 'exercise' }, { language: 'english' }), /left arm/);
    const req = buildRequest({ message: 'gir gaya', fallCaution: true, classification: { language: 'hinglish' } });
    assert.match(dataOf(req), /The user had a fall\. Ask no question\./);
    assert.ok(!/chest pain or breathlessness/.test(dataOf(req)));
});

test('symptom follow-up: 65+ asked again after 1 day and told about a doctor after a week; adults after 2 days / 2 weeks', () => {
    const symptom = { _id: 's1', name: 'cough', key: 'cough', startedAt: daysAgo(8), lastMentionedAt: daysAgo(8), lastAskedAt: daysAgo(1.5), lastStatus: 'same' };
    const base = { classification: { intent: 'health_coaching', language: 'english', topics: ['general'] }, freshness: {}, targets: null, now: NOW, symptoms: [symptom] };
    const older = pickCheckIn({ ...base, profileContext: { basic: { age: 70 } } });
    assert.equal(older?.kind, 'symptom');
    assert.match(older.instruction, /a week or more/);
    const adult = pickCheckIn({ ...base, profileContext: { basic: { age: 30 } } });
    assert.notEqual(adult?.kind, 'symptom');
});

test('prompt: no "X and Y?" questions, no telling the user their data does not match', () => {
    const req = buildRequest({ message: 'x', classification: { language: 'english' } });
    const system = Array.isArray(req.system) ? req.system.map((b) => b.text).join('\n') : String(req.system);
    assert.match(system, /never two questions joined with "and" \/ "aur"/);
    assert.match(system, /Never point out that their logged data "doesn't match"/);
});

test('caution turn: model-written 112 / 108 lines are dropped while streaming, nothing else', () => {
    const { createEmergencyLineFilter, isEmergencyLine } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
    assert.ok(isEmergencyLine('Agar behoshi ho to turant 112 par call karein.'));
    assert.ok(isEmergencyLine('Call 108 for an ambulance'));
    assert.ok(!isEmergencyLine('Dinner: dal and rice, about 108 g carbs'));
    assert.ok(!isEmergencyLine('Aaj 112 kcal aur khao'));
    assert.ok(!isEmergencyLine('Aaj hi doctor ko dikhayein agar dard rahe.'));

    const sent = [];
    const f = createEmergencyLineFilter((t) => sent.push(t));
    const answer = 'Sushila ji, aaram karein.\n\n• Sujan ho to thanda sek.\n\nAgar behoshi, tez sar dard ya ulti ho, to tur'
        + 'ant 112 par call karein.\n\nAage ke liye non-slip mat lagayein.';
    for (const chunk of answer.match(/.{1,7}/gs)) f.push(chunk); // arbitrary token cuts
    const text = f.end();
    assert.equal(text, 'Sushila ji, aaram karein.\n\n• Sujan ho to thanda sek.\n\nAage ke liye non-slip mat lagayein.');
    assert.equal(sent.join(''), text);

    const g = createEmergencyLineFilter(() => {});
    g.push('Rest today.\n\nCall 112 right away if it gets worse.');
    assert.equal(g.end(), 'Rest today.');
});

test('emergency filter: works per sentence (first words go out before the line ends; a 112 sentence mid-paragraph goes alone)', () => {
    const { createEmergencyLineFilter } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
    const sent = [];
    const f = createEmergencyLineFilter((t) => sent.push(t));
    f.push('Aaj aaram kijiye. Kal');
    assert.equal(sent.join(''), 'Aaj aaram kijiye. '); // sent before any newline
    f.push(' walk kijiye. Agar chakkar aaye to turant 112 pe call kariye. Paani piyein.');
    assert.equal(f.end(), 'Aaj aaram kijiye. Kal walk kijiye. Paani piyein.');
    const g = createEmergencyLineFilter(() => {});
    g.push('Weight 7.5 kg kam hua. Good.');
    assert.equal(g.end(), 'Weight 7.5 kg kam hua. Good.');
});
