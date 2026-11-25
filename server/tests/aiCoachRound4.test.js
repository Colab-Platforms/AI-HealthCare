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
