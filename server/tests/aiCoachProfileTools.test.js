/**
 * Chat -> profile save rules (profileTools) on the real ProfileWriteService
 * with the in-memory repo. No DB, no API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createProfileWriteService } = require('../modules/health-profile/services/profileWriteService');
const {
    createProfileTools, triageFacts, splitDose, listItem, describeFact, isYes, isNo, isUndo,
} = require('../modules/ai-coach/tools/profileTools');
const { createMemoryProfileRepo } = require('./helpers/memoryProfileRepo');

const USER = String(new mongoose.Types.ObjectId());

function setup() {
    const repo = createMemoryProfileRepo({
        users: { [USER]: { _id: USER, profile: { age: 30, weight: 70, height: 172, allergies: [], lifestyle: { waterGoalMl: 2000 } } } },
    });
    const service = createProfileWriteService({ repo, afterCommit: async () => {} });
    const effects = [];
    const weightLogs = [];
    const removedLogs = [];
    const tools = createProfileTools({
        service, repo,
        sideEffects: { afterProfileChange: async (u, s) => { effects.push(s); } },
        // Stand-in for services/weightLogService: the profile part of a weigh-in.
        logWeight: async ({ userId, weightKg, source }) => {
            await service.updateSection(userId, 'body', { weightKg }, { source });
            weightLogs.push({ weightKg, source });
            return { metric: { _id: `m${weightLogs.length}` }, created: true };
        },
        revertWeightLog: async (log) => { removedLogs.push(log.metricId); },
        logger: { warn: () => {}, error: () => {} },
    });
    return { repo, service, tools, effects, weightLogs, removedLogs, hp: () => repo.state.profiles[USER], user: () => repo.state.users[USER] };
}

const fact = (target, value, over = {}) => ({ target, value, none: false, statedAs: 'volunteered', aboutSelf: true, ...over });

test('triage: answer to the pending question saves now; volunteered asks first; questions / others ignored', () => {
    const pending = { field: 'allergies', question: 'Any allergies?' };
    const { saveNow, confirm } = triageFacts([
        fact('allergies', 'Peanut', { statedAs: 'answer' }),
        fact('medications', 'Metformin 500mg', { statedAs: 'answer' }), // answer, but not to what we asked
        fact('conditions', 'Diabetes', { statedAs: 'question' }),        // "do I have diabetes?"
        fact('conditions', 'Asthma', { statedAs: 'hypothetical' }),
        fact('conditions', 'Diabetes', { aboutSelf: false }),           // "my friend is diabetic"
        fact('lifestyle.smoking', 'current'),
        fact('allergies', '   '),                                       // empty value, not "none"
    ], pending);
    assert.deepEqual(saveNow.map((f) => f.target), ['allergies']);
    assert.deepEqual(confirm.map((f) => f.target), ['medications', 'lifestyle.smoking']);
});

test('triage: "basics" question is answered by age / height / weight facts', () => {
    const { saveNow } = triageFacts([fact('body.weightKg', '68', { statedAs: 'answer' }), fact('basic.age', '31', { statedAs: 'answer' })], { field: 'basics' });
    assert.equal(saveNow.length, 2);
});

test('parsing: dose split, family relation, item shapes', () => {
    assert.deepEqual(splitDose('Metformin 500mg'), { name: 'Metformin', dose: '500mg' });
    assert.deepEqual(splitDose('Vitamin D3 60000 IU'), { name: 'Vitamin D3', dose: '60000IU' });
    assert.deepEqual(splitDose('Thyroxine'), { name: 'Thyroxine' });
    assert.deepEqual(listItem('familyHistory', 'Mother: Diabetes'), { relation: 'Mother', condition: 'Diabetes' });
    assert.deepEqual(listItem('allergies', ' Peanut '), { allergen: 'Peanut' });
    assert.match(describeFact(fact('allergies', 'Peanut')), /allergy: Peanut/);
    assert.match(describeFact(fact('medications', '', { none: true }), true), /koi dawai nahi/);
});

test('yes / no / undo detection; undo needs a short direct message', () => {
    for (const m of ['yes', 'haan save kar do', 'ok', 'ji haan', 'theek hai']) assert.ok(isYes(m), m);
    for (const m of ['no', 'nahi', 'mat karo', "don't"]) assert.ok(isNo(m), m);
    for (const m of ['undo', 'hata do', 'that\'s wrong', 'vo galat hai']) assert.ok(isUndo(m), m);
    assert.ok(!isUndo("what's wrong with my sleep?"));
    assert.ok(!isUndo('can you remove that tiredness from my morning, what should I do about my sleep and workout plan today')); // long message
    assert.ok(!isYes('yesterday I slept badly'));
});

test('saveFacts: list items, structured dose, source chat, mirror, history ids for undo', async () => {
    const { tools, hp, user } = setup();
    const saved = await tools.saveFacts(USER, [fact('allergies', 'Peanut'), fact('medications', 'Metformin 500mg')]);
    assert.equal(saved.length, 2);
    assert.ok(saved.every((s) => s.historyId));
    const med = hp().medications.items[0];
    assert.deepEqual([med.name, med.dose, med.source], ['Metformin', '500mg', 'chat']);
    assert.deepEqual(user().profile.allergies, ['Peanut']);
    assert.deepEqual(user().profile.medicalHistory.currentMedications, ['Metformin 500mg']);
});

test('saveFacts: "none" marks the list none; injuries none -> [\'none\'], later injury replaces it', async () => {
    const { tools, hp } = setup();
    await tools.saveFacts(USER, [fact('medications', '', { none: true }), fact('fitness.limitations', '', { none: true })]);
    assert.equal(hp().medications.state, 'none');
    assert.deepEqual(hp().fitness.limitations, ['none']);
    await tools.saveFacts(USER, [fact('fitness.limitations', 'Knee pain')]);
    assert.deepEqual(hp().fitness.limitations, ['knee pain']);
});

test('saveFacts: scalars coerced; invalid values skipped without failing the rest', async () => {
    const { tools, hp, effects } = setup();
    const saved = await tools.saveFacts(USER, [
        fact('diet.preference', 'Vegetarian'),
        fact('basic.age', '31'),
        fact('lifestyle.smoking', 'sometimes'), // not in the enum -> skipped
        fact('lifestyle.sleepHours', 'abc'),     // not a number -> skipped
    ]);
    assert.deepEqual(saved.map((s) => s.target), ['diet.preference', 'basic.age']);
    assert.equal(hp().diet.preference, 'vegetarian');
    assert.equal(hp().basic.age, 31);
    assert.ok(effects[0].includes('basic')); // nutrition side effects for basic/body/goals
});

test('saveFacts: weight said in chat goes through the app\'s weight log (graph, goal), not just the profile', async () => {
    const { tools, hp, weightLogs } = setup();
    const saved = await tools.saveFacts(USER, [fact('body.weightKg', '68.5 kg')]);
    assert.deepEqual(weightLogs, [{ weightKg: 68.5, source: 'chat' }]);
    assert.equal(hp().body.weightKg, 68.5);
    assert.equal(saved[0].weightLog.metricId, 'm1');
    assert.equal(saved[0].weightLog.created, true);
    assert.equal(saved[0].weightLog.kg, 68.5);
    assert.deepEqual(await tools.saveFacts(USER, [fact('body.weightKg', '900')]), []); // out of range
});

test('saveFacts: re-saving a known fact is not reported as saved (nothing to undo)', async () => {
    const { tools } = setup();
    await tools.saveFacts(USER, [fact('allergies', 'Peanut')]);
    const again = await tools.saveFacts(USER, [fact('allergies', 'peanut')]);
    assert.deepEqual(again, []);
});

test('undoSaved: reverts the batch, newest first; mirror restored; the weigh-in the chat created is removed', async () => {
    const { tools, hp, user, removedLogs } = setup();
    const saved = await tools.saveFacts(USER, [fact('allergies', 'Peanut'), fact('body.weightKg', '66')]);
    assert.equal(await tools.undoSaved(USER, saved), 2);
    assert.equal(hp().allergies.items.length, 0);
    assert.equal(hp().body.weightKg, 70);
    assert.equal(user().profile.weight, 70);
    assert.deepEqual(removedLogs, ['m1']);
});
