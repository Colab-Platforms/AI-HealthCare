// Activity guard (27 Nov): exercise x health profile rules + the guard service
// (cooldown, race claim, time budget, coach availability, language).
const { test } = require('node:test');
const assert = require('node:assert');

const { checkExercise, exerciseFacts } = require('../modules/health-profile/services/activityGuard/exerciseRules');
const { createActivityGuard, COOLDOWN_MS } = require('../modules/health-profile/services/activityGuard/guardService');

const hp = (over = {}) => ({
    basic: { age: 35 },
    conditions: { items: [] }, medications: { items: [] }, disabilities: { items: [] },
    fitness: { limitations: [] },
    ...over,
});
const meds = (...names) => ({ medications: { items: names.map((name) => ({ name, active: true })) } });
const conds = (...names) => ({ conditions: { items: names.map((name) => ({ name, status: 'active' })) } });
const codes = (profile, activity, symptoms) => checkExercise(activity, exerciseFacts(hp(profile), { symptoms })).map((a) => a.code);

test('painkiller + running -> painkiller caution; painkiller + gentle yoga -> nothing', () => {
    assert.deepStrictEqual(codes(meds('Brufen 400'), { activityType: 'running', intensity: 'medium', duration: 30 }), ['painkiller']);
    assert.deepStrictEqual(codes(meds('Brufen 400'), { activityType: 'yoga', intensity: 'low', duration: 30 }), []);
});

test('painkiller + kidney condition + hard workout -> important, not the plain one', () => {
    const c = codes({ ...meds('diclofenac'), ...conds('Chronic kidney disease') }, { activityType: 'hiit', intensity: 'high', duration: 30 });
    assert.ok(c.includes('painkiller_kidney'));
    assert.ok(!c.includes('painkiller'));
});

test('paracetamol + knee injury + running -> pain masking + injury load', () => {
    const c = codes({ ...meds('Dolo 650'), fitness: { limitations: ['knee pain'] } }, { activityType: 'running', duration: 20 });
    assert.ok(c.includes('pain_masking'));
    assert.ok(c.includes('injury_load'));
});

test('knee injury: running alerts, swimming does not', () => {
    const p = { fitness: { limitations: ['ACL tear left knee'] } };
    assert.ok(codes(p, { activityType: 'running', duration: 20 }).includes('injury_load'));
    assert.deepStrictEqual(codes(p, { activityType: 'swimming', duration: 20 }), []);
});

test('injury_load names the body part in the message', () => {
    const [a] = checkExercise({ activityType: 'weightlifting', duration: 40 }, exerciseFacts(hp({ fitness: { limitations: ['slip disc'] } })));
    assert.strictEqual(a.code, 'injury_load');
    assert.match(a.text.english, /back/);
    assert.match(a.text.hinglish, /kamar/);
});

test('heart condition + HIIT -> important first', () => {
    const c = checkExercise({ activityType: 'hiit', intensity: 'high', duration: 20 }, exerciseFacts(hp(conds('Coronary artery disease'))));
    assert.strictEqual(c[0].code, 'heart_vigorous');
    assert.strictEqual(c[0].level, 'important');
});

test('red-flag symptom overrides every other tip', () => {
    const c = codes({ ...meds('ibuprofen'), ...conds('Hypertension') }, { activityType: 'weightlifting', duration: 40 }, [{ name: 'chest pain' }]);
    assert.deepStrictEqual(c, ['symptom_red_flag']);
});

test('fever: running alerts, a gentle stretch does not', () => {
    assert.ok(codes({}, { activityType: 'running', duration: 20 }, [{ name: 'fever' }]).includes('symptom_fever'));
    assert.deepStrictEqual(codes({}, { activityType: 'stretching_mobility', duration: 15 }, [{ name: 'fever' }]), []);
});

test('epilepsy + swimming -> important', () => {
    assert.deepStrictEqual(codes(conds('Epilepsy'), { activityType: 'swimming', duration: 30 }), ['epilepsy_water_height']);
});

test('insulin via diabetes.medicationType + long walk -> hypo risk', () => {
    const c = codes({ diabetes: { type: 'Type 1', medicationType: ['Insulin'] } }, { activityType: 'walking', duration: 75 });
    assert.ok(c.includes('hypo_risk'));
});

test('beta blocker only for hard cardio', () => {
    assert.ok(codes(meds('Metoprolol 25'), { activityType: 'running', intensity: 'high', duration: 30 }).includes('beta_blocker'));
    assert.ok(!codes(meds('Metoprolol 25'), { activityType: 'gym_strength', intensity: 'high', duration: 30 }).includes('beta_blocker'));
});

test('stopped medicine (active:false) and resolved condition add nothing', () => {
    const p = { medications: { items: [{ name: 'ibuprofen', active: false }] }, conditions: { items: [{ name: 'Heart disease', status: 'resolved' }] } };
    assert.deepStrictEqual(codes(p, { activityType: 'hiit', intensity: 'high', duration: 30 }), []);
});

test('empty / missing profile -> no alerts, no throw', () => {
    assert.deepStrictEqual(checkExercise({ activityType: 'running', duration: 30 }, exerciseFacts(null)), []);
    assert.deepStrictEqual(checkExercise(null, exerciseFacts(null)), []);
});

test('65+ and high impact; blood thinner and contact sport; quinolone and lifting', () => {
    assert.ok(codes({ basic: { age: 70 } }, { activityType: 'jump_rope', duration: 10 }).includes('older_adult'));
    assert.ok(codes(meds('Ecosprin 75'), { activityType: 'football', duration: 60 }).includes('blood_thinner'));
    assert.ok(codes(meds('Ciprofloxacin 500'), { activityType: 'weightlifting', duration: 45 }).includes('quinolone_tendon'));
});

// ── guard service ──────────────────────────────────────────────────────────
function memoryDeps({ profile = hp(meds('Brufen')), symptoms = [], state = null, coach = true, claimResult = true, slowMs = 0 } = {}) {
    const calls = { claim: [] };
    const box = { state };
    return {
        calls, box,
        async loadProfile() { if (slowMs) await new Promise((r) => setTimeout(r, slowMs)); return profile; },
        async loadSymptoms() { return symptoms; },
        async loadState() { return box.state; },
        async claim(userId, arg) {
            calls.claim.push(arg);
            if (!claimResult) return false;
            box.state = { ...(box.state || {}), alertLog: [...(box.state?.alertLog || []), ...arg.entries] };
            return true;
        },
        async coachAvailable() { return coach; },
    };
}
const user = { _id: 'u1', name: 'Rahul Sharma' };
const run = { activityType: 'running', intensity: 'medium', duration: 30 };

test('guard: first time opens the coach with a named, bulleted message', async () => {
    const deps = memoryDeps();
    const { alerts, coach } = await createActivityGuard(deps).checkExercise(user, run, { mode: 'precheck' });
    assert.strictEqual(alerts[0].code, 'painkiller');
    assert.ok(coach.open);
    assert.match(coach.text, /^Rahul, before you start running/);
    assert.match(coach.text, /• You take Brufen/);
    assert.deepStrictEqual(coach.codes, ['painkiller']);
    assert.strictEqual(deps.calls.claim.length, 1);
    assert.strictEqual(deps.calls.claim[0].activityAlert.kind, 'exercise');
});

test('guard: same alert again within cooldown -> alerts returned, coach stays closed', async () => {
    const deps = memoryDeps();
    let t = new Date('2026-11-27T05:00:00Z');
    const guard = createActivityGuard(deps, { now: () => t });
    assert.ok((await guard.checkExercise(user, run)).coach);
    t = new Date(t.getTime() + 2 * 3600 * 1000);
    const again = await guard.checkExercise(user, run, { mode: 'logged' });
    assert.strictEqual(again.alerts.length, 1);
    assert.strictEqual(again.coach, null);
    t = new Date(t.getTime() + COOLDOWN_MS.caution);
    assert.ok((await guard.checkExercise(user, run)).coach, 'after the cooldown it speaks again');
});

test('guard: lost race (claim false) -> no second coach', async () => {
    const r = await createActivityGuard(memoryDeps({ claimResult: false })).checkExercise(user, run);
    assert.strictEqual(r.coach, null);
    assert.strictEqual(r.alerts.length, 1);
});

test('guard: no coach on the plan -> alerts only, nothing recorded', async () => {
    const deps = memoryDeps({ coach: false });
    const r = await createActivityGuard(deps).checkExercise(user, run);
    assert.strictEqual(r.coach, null);
    assert.strictEqual(deps.calls.claim.length, 0);
});

test('guard: Hinglish chat -> Hinglish message', async () => {
    const r = await createActivityGuard(memoryDeps({ state: { lastLanguage: 'hinglish' } })).checkExercise(user, run, { mode: 'logged' });
    assert.match(r.coach.text, /^Rahul, Running log ho gaya/);
    assert.match(r.alerts[0].message, /painkiller/);
});

test('guard: slow profile read -> empty result in budget, and no late claim', async () => {
    const deps = memoryDeps({ slowMs: 2000 });
    const started = Date.now();
    const r = await createActivityGuard(deps).checkExercise(user, run);
    assert.ok(Date.now() - started < 1900);
    assert.deepStrictEqual(r, { alerts: [], coach: null });
    await new Promise((res) => setTimeout(res, 800));
    assert.strictEqual(deps.calls.claim.length, 0, 'the late run must not record an alert nobody saw');
});

test('guard: profile read throws -> safe empty result', async () => {
    const deps = memoryDeps();
    deps.loadProfile = async () => { throw new Error('db down'); };
    const r = await createActivityGuard(deps).checkExercise(user, run);
    assert.deepStrictEqual(r, { alerts: [], coach: null });
});

test('guard: nothing in the profile -> empty result', async () => {
    const deps = memoryDeps({ profile: hp() });
    const r = await createActivityGuard(deps).checkExercise(user, run);
    assert.deepStrictEqual(r, { alerts: [], coach: null });
});

test('guard: slow coach check -> alerts still returned, coach dropped, no late claim', async () => {
    const deps = memoryDeps();
    deps.coachAvailable = () => new Promise((r) => setTimeout(() => r(true), 2000));
    const r = await createActivityGuard(deps).checkExercise(user, run);
    assert.strictEqual(r.alerts[0].code, 'painkiller');
    assert.strictEqual(r.coach, null);
    await new Promise((res) => setTimeout(res, 800));
    assert.strictEqual(deps.calls.claim.length, 0);
});

test('coach prompt carries the recent activity alert so "kyu?" is understood', () => {
    const { buildRequest } = require('../modules/ai-coach/response/responseGenerator');
    const req = buildRequest({ message: 'kyu?', classification: { language: 'hinglish' }, activityAlert: { text: 'You take Brufen (a painkiller)...', at: new Date() } });
    assert.match(JSON.stringify(req), /Brufen \(a painkiller\)/);
    assert.match(JSON.stringify(req), /never tell them to stop or change a medicine/);
    assert.doesNotMatch(JSON.stringify(buildRequest({ message: 'kyu?', classification: {} })), /showed the user this note/);
});
