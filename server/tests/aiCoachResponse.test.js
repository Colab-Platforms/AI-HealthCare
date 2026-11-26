/**
 * Response generator: prompt layout (caching + safety rules) and streaming,
 * with a fake client. No API calls.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildRequest, streamAnswer, COACH_RULES } = require('../modules/ai-coach/response/responseGenerator');

const profileContext = { summary: 'Age: 30, gender: male\nAllergies: Peanut (severe)', completeness: { percent: 60 } };
const results = [
    { specialist: 'recovery', status: 'completed', findings: ['Recovery score today: 38/100 (Low).'], missing_data: [] },
    { specialist: 'sleep', status: 'timeout', findings: [], missing_data: ['sleep'] },
    { specialist: 'fitness', status: 'no_data', findings: ['No activity or workouts logged recently.'], missing_data: ['recent_workouts'] },
];

test('layout: rules and profile are cached system blocks; per-message data is a final system message', () => {
    const req = buildRequest({ message: 'tired, gym today?', userName: 'Rahul', profileContext, specialistResults: results });
    assert.equal(req.system.length, 2);
    assert.equal(req.system[0].text, COACH_RULES);
    assert.ok(req.system.every((b) => b.cache_control?.type === 'ephemeral'));
    assert.match(req.system[1].text, /Rahul[\s\S]*Peanut \(severe\)/);
    assert.ok(!/Today \(UTC\)/.test(req.system[0].text + req.system[1].text)); // no volatile text in the cached prefix

    const last = req.messages[req.messages.length - 1];
    const userMsg = req.messages[req.messages.length - 2];
    assert.equal(last.role, 'system');
    assert.deepEqual(userMsg, { role: 'user', content: 'tired, gym today?' });
    assert.match(last.content, /\[recovery\] Recovery score today: 38\/100/);
    assert.match(last.content, /\[sleep\] Data unavailable right now \(timeout\)\. Don't guess it\./);
    assert.match(last.content, /\[fitness\] No activity[\s\S]*missing: recent_workouts/);
});

test('layout: gap question at the end (or blocking), confirm and saved facts, Hinglish wording', () => {
    const end = buildRequest({ message: 'm', specialistResults: [], gapQuestion: { question: 'Any injury?', blocking: false } });
    assert.match(end.messages.at(-1).content, /After answering, ask this one question as the last line: "Any injury\?"/);
    const block = buildRequest({ message: 'm', gapQuestion: { question: 'Any medicines?', blocking: true } });
    assert.match(block.messages.at(-1).content, /Do NOT give the recommendation yet/);

    const c = buildRequest({
        message: 'm', classification: { language: 'hinglish' },
        confirmFacts: [{ target: 'medications', value: '', none: true }],
        savedFacts: [{ target: 'allergies', value: 'Peanut' }],
    });
    assert.match(c.messages.at(-1).content, /koi dawai nahi[\s\S]*save this to their profile/);
    assert.match(c.messages.at(-1).content, /Just saved to their profile: allergy: Peanut[\s\S]*undo/);
});

test('history: trimmed, sanitised, starts with a user turn', () => {
    const history = [
        { role: 'assistant', content: 'Hello! How can I help?' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'Hi Rahul' },
        { role: 'tool', content: 'x' },
        { role: 'user', content: '' },
        { role: 'user', content: 'a'.repeat(5000) },
    ];
    const req = buildRequest({ message: 'next', history });
    assert.equal(req.messages[0].role, 'user');
    assert.ok(req.messages.every((m) => ['user', 'assistant', 'system'].includes(m.role)));
    assert.ok(req.messages.every((m) => m.content.length <= 2000 || m.role === 'system'));
});

test('stream: Sonnet 5.5, no temperature, thinking off between tools, low effort, fallback; tokens forwarded', async () => {
    let params;
    const events = [
        { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: '' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Aaj ' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'light rakho.' } },
    ];
    const client = {
        beta: {
            messages: {
                stream: (p) => {
                    params = p;
                    return {
                        async *[Symbol.asyncIterator]() { for (const e of events) yield e; },
                        finalMessage: async () => ({ stop_reason: 'end_turn', model: 'claude-sonnet-5-5', usage: { input_tokens: 100, output_tokens: 8 } }),
                    };
                },
            },
        },
    };
    const tokens = [];
    const out = await streamAnswer({ client, request: buildRequest({ message: 'm' }), onToken: (t) => tokens.push(t) });
    assert.deepEqual(tokens, ['Aaj ', 'light rakho.']);
    assert.equal(out.text, 'Aaj light rakho.');
    assert.equal(params.model, 'claude-sonnet-5-5');
    assert.equal(params.temperature, undefined);
    assert.deepEqual(params.thinking, { type: 'between_tools' });
    assert.equal(params.output_config.effort, 'low');
    assert.equal(params.fallbacks, 'default');
    assert.deepEqual(params.betas, ['server-side-fallback-2026-07-01']);
});
