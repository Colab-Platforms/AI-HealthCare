/**
 * /api/chat glue for Coach V2: flag off = old chat, typed events only for
 * opt-in apps, fallback when V2 fails before sending text, usage logging.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const mongoose = require('mongoose');

const { handleCoachV2, cleanHistory } = require('../modules/ai-coach/chatHandler');
const { createMemoryCoachStateRepo } = require('../modules/ai-coach/orchestrator/coachStateRepo');

const USER = new mongoose.Types.ObjectId();

function fakeDeps({ answerError = null, facts = [] } = {}) {
    return {
        client: {
            messages: {
                create: async () => ({
                    stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 },
                    content: [{ type: 'text', text: JSON.stringify({ intent: 'profile_update', topics: [], specialists: [], timeframe: 'unspecified', symptoms: [], redFlag: false, distress: false, language: 'english', recommendsFoodOrSupplement: false, facts }) }],
                }),
            },
            beta: {
                messages: {
                    stream: () => {
                        if (answerError) throw answerError;
                        return {
                            async *[Symbol.asyncIterator]() { yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Noted.' } }; },
                            finalMessage: async () => ({ stop_reason: 'end_turn', model: 'claude-sonnet-5-5', usage: {} }),
                        };
                    },
                },
            },
        },
        getProfileContext: async () => ({ summary: '', completeness: { percent: 50 }, allergies: { state: 'none' }, medications: { state: 'none' }, conditions: { state: 'none' } }),
        coachStateRepo: createMemoryCoachStateRepo(),
        profileTools: { saveFacts: async (u, f) => f.map((x) => ({ ...x, historyId: 'h1' })), undoSaved: async () => 0 },
        logger: { warn: () => {}, error: () => {} },
        specialistDeps: {
            sleep: { getSleepAnalytics: async () => ({ entries: [] }) },
            recovery: { getRecoveryAnalytics: async () => ({ entries: [] }) },
        },
    };
}

function harness(body) {
    const res = new EventEmitter();
    res.writableEnded = false;
    const req = { user: { _id: USER, name: 'Coach Test' }, body, res };
    const out = { tokens: [], events: [], finished: 0 };
    return {
        req,
        out,
        io: {
            sendToken: (t) => out.tokens.push(t),
            sendEvent: (e) => out.events.push(e),
            finishStream: () => { out.finished++; },
        },
    };
}

async function withEnv(env, fn) {
    const old = { AI_COACH_V2: process.env.AI_COACH_V2, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY };
    Object.assign(process.env, env);
    try { return await fn(); } finally {
        for (const [k, v] of Object.entries(old)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
}

const ON = { AI_COACH_V2: 'true', ANTHROPIC_API_KEY: 'sk-ant-test' };
const NOTE = { target: 'allergies', value: 'Dust', none: false, statedAs: 'volunteered', aboutSelf: true };

test('flag off: returns false, sends nothing (old chat runs)', async () => {
    await withEnv({ AI_COACH_V2: 'false', ANTHROPIC_API_KEY: 'sk-ant-test' }, async () => {
        const h = harness({ query: 'hello there' });
        assert.equal(await handleCoachV2({ req: h.req, ...h.io, deps: fakeDeps() }), false);
        assert.equal(h.out.tokens.length + h.out.finished, 0);
    });
});

test('old app (no opt-in): only token events, never typed events', async () => {
    await withEnv(ON, async () => {
        const h = harness({ query: 'I am allergic to dust' });
        assert.equal(await handleCoachV2({ req: h.req, ...h.io, deps: fakeDeps({ facts: [NOTE] }) }), true);
        assert.deepEqual(h.out.tokens, ['Noted.']);
        assert.deepEqual(h.out.events, []);
        assert.equal(h.out.finished, 1);
    });
});

test('new app (coachEvents: true): typed profile events too', async () => {
    await withEnv(ON, async () => {
        const h = harness({ query: 'I am allergic to dust', coachEvents: true });
        await handleCoachV2({ req: h.req, ...h.io, deps: fakeDeps({ facts: [NOTE] }) });
        assert.equal(h.out.events[0].type, 'profile_confirm');
        assert.equal(h.out.events[0].facts[0].value, 'Dust');
    });
});

test('V2 failing before any text returns false (old chat answers), without finishing the stream', async () => {
    await withEnv(ON, async () => {
        const h = harness({ query: 'how did I sleep' });
        const silenced = console.error;
        console.error = () => {};
        try {
            assert.equal(await handleCoachV2({ req: h.req, ...h.io, deps: fakeDeps({ answerError: new Error('overloaded') }) }), false);
        } finally { console.error = silenced; }
        assert.equal(h.out.finished, 0);
    });
});

test('history: roles normalised, empty dropped, last turns only', () => {
    const h = cleanHistory([{ role: 'bot', content: 'x' }, { role: 'user', content: ' ' }, { role: 'user', content: 'hi' }, null]);
    assert.deepEqual(h, [{ role: 'assistant', content: 'x' }, { role: 'user', content: 'hi' }]);
    assert.equal(cleanHistory(Array.from({ length: 40 }, (_, i) => ({ role: 'user', content: `m${i}` }))).length, 12);
    assert.deepEqual(cleanHistory('nope'), []);
});
