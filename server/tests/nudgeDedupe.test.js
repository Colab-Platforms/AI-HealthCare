/**
 * Nudge dedupe: claim-first ordering and per-week identity for inactivity.
 *
 * NudgeLog / fcmService / aiService are stubbed on their exports BEFORE
 * nudgeService is required (it destructures them at load), so no DB, FCM or
 * model call happens.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const calls = [];
const fcm = require('../services/fcmService');
fcm.sendToUser = async (userId, payload) => { calls.push(['push', String(userId), payload.data.type]); return { success: true }; };

const ai = require('../services/aiService');
ai.makeAnthropicRequest = async () => '{"title":"Hi","body":"There"}';

const NudgeLog = require('../models/NudgeLog');
let created = [];
let failWith11000 = false;
NudgeLog.create = async (doc) => {
    calls.push(['claim', String(doc.userId), doc.type, doc.periodKey]);
    if (failWith11000) { const e = new Error('dup'); e.code = 11000; throw e; }
    const row = { _id: `log${created.length}`, ...doc };
    created.push(row);
    return row;
};
NudgeLog.updateOne = async (filter, update) => { calls.push(['update', filter._id, update.delivered]); return {}; };

const { sendNudge, isoWeekKey, periodKeyFor } = require('../services/nudgeService');

const reset = () => { calls.length = 0; created = []; failWith11000 = false; };

test('isoWeekKey follows ISO-8601 (week 1 holds the first Thursday)', () => {
    assert.equal(isoWeekKey(new Date('2026-01-01T00:00:00Z')), '2026-W01');
    assert.equal(isoWeekKey(new Date('2025-12-29T00:00:00Z')), '2026-W01'); // Mon of that week
    assert.equal(isoWeekKey(new Date('2026-10-21T00:00:00Z')), '2026-W43');
});

test('periodKey: reportId for report nudges, ISO week for inactivity', () => {
    assert.equal(periodKeyFor('followup_3d', 'abc123'), 'abc123');
    assert.equal(periodKeyFor('score_drop', 'def456'), 'def456');
    assert.match(periodKeyFor('inactivity_7d', undefined), /^\d{4}-W\d{2}$/);
});

test('claim is written BEFORE the push, then updated with the result', async () => {
    reset();
    await sendNudge({ userId: 'u1', reportId: 'r1', type: 'followup_3d', userName: 'Asha', reportData: {} });
    assert.deepEqual(calls.map((c) => c[0]), ['claim', 'push', 'update']);
    assert.equal(calls[1][2], 'followup_3d');
    assert.equal(calls[2][2], true);
});

test('a lost claim (duplicate) sends no push', async () => {
    reset();
    failWith11000 = true;
    await sendNudge({ userId: 'u1', reportId: 'r1', type: 'followup_3d', userName: 'Asha', reportData: {} });
    assert.deepEqual(calls.map((c) => c[0]), ['claim']);
});

test('inactivity nudge carries its own type through to the log', async () => {
    reset();
    await sendNudge({ userId: 'u2', type: 'inactivity_7d', userName: 'Ravi', reportData: {} });
    assert.equal(calls[0][2], 'inactivity_7d');
    assert.match(calls[0][3], /^\d{4}-W\d{2}$/);
});
