/**
 * Fixes from the 25 Nov manual chat run:
 *   - stretched / casual "yess", "haanji", "noo" are read as yes / no
 *   - one question per reply: no fixed "save this?" line when the answer
 *     already ends with a question
 *   - fixed Hinglish texts have no tu / aap / tum word (fit either form)
 *   - prompt: never claim a save that did not happen
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { isYes, isNo } = require('../modules/ai-coach/tools/profileTools');
const { endingQuestion, confirmText } = require('../modules/ai-coach/orchestrator/mainCoachGraph');
const { buildRequest } = require('../modules/ai-coach/response/responseGenerator');
const { scopeReply } = require('../modules/ai-coach/safety/scopeGuard');

test('yes / no: stretched and casual forms', () => {
    for (const m of ['yess', 'yesss please', 'Yes', 'haan', 'haaan', 'haanji', 'haan ji', 'ji', 'okk', 'bilkul', 'save karo', 'kardo', 'ha bhai save kar']) {
        assert.ok(isYes(m), `yes: ${m}`);
    }
    for (const m of ['noo', 'nahi', 'nahii', 'nah', 'rehne de']) assert.ok(isNo(m), `no: ${m}`);
    for (const m of ['ya phir kal', 'hai na', 'now tell me', 'what is my weight', 'yesterday ka water']) {
        assert.ok(!isYes(m), `not yes: ${m}`);
    }
    assert.ok(!isNo('now tell me'));
});

test('endingQuestion: save question / other question / none', () => {
    assert.equal(endingQuestion('Advice here.\n\nShould I update your weight to 70 kg in your profile?'), 'save');
    assert.equal(endingQuestion('Advice.\n\nYe profile mein save kar doon?'), 'save');
    assert.equal(endingQuestion('Advice.\n\nAb pait kaisa hai?'), 'other');
    assert.equal(endingQuestion('Advice only. Nothing asked.'), null);
    assert.equal(endingQuestion(''), null);
});

test('confirmText: one line, no tu / aap / tum in Hinglish', () => {
    const facts = [{ target: 'body.weightKg', value: '70' }];
    const hi = confirmText(facts, true);
    assert.match(hi, /weight \(kg\): 70/);
    assert.ok(!/\b(tu|tum|tumne|tumhari|aap|aapka|aapki|aapko)\b/i.test(hi));
    assert.match(confirmText(facts, false), /Should I save this to your profile\? \(yes \/ no\)/);
});

test('fixed Hinglish questions and scope replies have no tu / aap / tum word', () => {
    const src = ['../modules/ai-coach/orchestrator/gapEngine', '../modules/ai-coach/orchestrator/checkIns']
        .map((p) => require('fs').readFileSync(require.resolve(p), 'utf8')).join('\n');
    const hiStrings = [...src.matchAll(/hi: ['`]([^'`]+)['`]/g)].map((m) => m[1]);
    assert.ok(hiStrings.length >= 5);
    for (const s of hiStrings) assert.ok(!/\b(tum|tumhari|tumne|aap|aapka|aapki|aapko)\b/i.test(s), s);
    for (const kind of ['off_topic', 'injection']) {
        assert.ok(!/\b(tum|tumhari|aap|aapki)\b/i.test(scopeReply(kind, { language: 'hinglish' })), kind);
    }
});

test('prompt forbids claiming a save that is not in the data', () => {
    const req = buildRequest({ message: 'yess', classification: { language: 'english' } });
    const system = Array.isArray(req.system) ? req.system.map((b) => b.text).join('\n') : String(req.system);
    assert.match(system, /Never say you saved, are saving, noted or updated anything/);
});

test('undo of a chat weight: weigh-in removed for this user and calorie targets re-synced', async () => {
    const { createProfileTools } = require('../modules/ai-coach/tools/profileTools');
    const calls = [];
    const tools = createProfileTools({
        service: { undo: async () => ({ changed: true, sections: ['body'] }) },
        repo: {},
        sideEffects: { afterProfileChange: async (userId, sections) => calls.push(['sync', userId, sections]) },
        revertWeightLog: async (log, userId) => calls.push(['revert', log.metricId, userId]),
        logger: { warn() {}, error() {} },
    });
    const n = await tools.undoSaved('u1', [{ target: 'body.weightKg', value: '70', historyId: 'h1', weightLog: { metricId: 'm1', kg: 70, created: true, loggedAt: '2026-11-25T10:00:00Z' } }]);
    assert.equal(n, 1);
    assert.deepEqual(calls, [['revert', 'm1', 'u1'], ['sync', 'u1', ['body']]]);
});

test('undo: nothing undone -> no side effects', async () => {
    const { createProfileTools } = require('../modules/ai-coach/tools/profileTools');
    let synced = false;
    const tools = createProfileTools({
        service: { undo: async () => { throw new Error('newer change'); } },
        repo: {},
        sideEffects: { afterProfileChange: async () => { synced = true; } },
        revertWeightLog: async () => {},
        logger: { warn() {}, error() {} },
    });
    assert.equal(await tools.undoSaved('u1', [{ target: 'diet.preference', historyId: 'h1' }]), 0);
    assert.equal(synced, false);
});

test('chat weight over a same-day reading: undo info keeps the old value (not a delete)', async () => {
    const { createProfileTools } = require('../modules/ai-coach/tools/profileTools');
    const tools = createProfileTools({
        service: {},
        repo: { findProfile: async () => ({ body: { weightKg: 74 } }), listHistory: async () => [{ _id: 'h9' }] },
        sideEffects: { afterProfileChange: async () => {} },
        logWeight: async () => ({ metric: { _id: 'm7' }, created: false, previousValue: 78 }),
        logger: { warn() {}, error() {} },
    });
    const [item] = await tools.saveFacts('u1', [{ target: 'body.weightKg', value: '70 kg', statedAs: 'answer' }]);
    assert.equal(item.weightLog.metricId, 'm7');
    assert.equal(item.weightLog.created, false);
    assert.equal(item.weightLog.previousValue, 78);
    assert.equal(item.weightLog.kg, 70);
    assert.ok(!Number.isNaN(Date.parse(item.weightLog.loggedAt)));
});
