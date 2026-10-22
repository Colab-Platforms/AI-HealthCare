/**
 * Eligibility checks must cost a constant number of queries, not a couple per
 * candidate. Models are stubbed on their statics; no DB is touched.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const HealthReport = require('../models/HealthReport');
const NudgeLog = require('../models/NudgeLog');
const FCMToken = require('../models/FCMToken');

const oid = () => new mongoose.Types.ObjectId();
const counts = { reportFind: 0, nudgeFind: 0, nudgeAggregate: 0, tokenDistinct: 0, tokenFind: 0, other: 0 };

const abnormal = { aiAnalysis: { metrics: { hba1c: { status: 'high', value: 7, unit: '%' } } } };
const chain = (rows) => ({ select: () => ({ lean: async () => rows }) });

const { getFollowupEligible, getInactivityEligible } = require('../services/nudgeService');

test('followup eligibility: constant queries, correct filtering', async () => {
    const N = 200;
    const reports = Array.from({ length: N }, () => ({ _id: oid(), user: oid(), reportType: 'blood', ...abnormal }));
    const alreadyNudged = new Set([String(reports[0]._id)]);
    const noToken = new Set([String(reports[1].user)]);

    HealthReport.find = () => { counts.reportFind++; return chain(reports); };
    NudgeLog.find = () => { counts.nudgeFind++; return chain(reports.filter((r) => alreadyNudged.has(String(r._id))).map((r) => ({ reportId: r._id }))); };
    FCMToken.distinct = async () => { counts.tokenDistinct++; return reports.filter((r) => !noToken.has(String(r.user))).map((r) => r.user); };
    NudgeLog.exists = FCMToken.exists = async () => { counts.other++; return null; };

    const eligible = await getFollowupEligible();

    assert.equal(eligible.length, N - 2); // minus the already-nudged and the no-token one
    assert.ok(!eligible.some((e) => String(e.reportId) === String(reports[0]._id)));
    assert.ok(!eligible.some((e) => String(e.userId) === String(reports[1].user)));
    assert.deepEqual(
        { reportFind: counts.reportFind, nudgeFind: counts.nudgeFind, tokenDistinct: counts.tokenDistinct, other: counts.other },
        { reportFind: 1, nudgeFind: 1, tokenDistinct: 1, other: 0 }, // independent of N, no per-report exists()
    );
});

test('inactivity eligibility: one aggregation, skips users nudged within 7 days', async () => {
    const recent = oid();
    const old = oid();
    const never = oid();
    const day = 24 * 60 * 60 * 1000;
    let aggregates = 0;

    FCMToken.find = () => chain([{ userId: recent }, { userId: old }, { userId: never }]);
    NudgeLog.aggregate = async () => {
        aggregates++;
        return [
            { _id: recent, lastSentAt: new Date(Date.now() - 2 * day) },
            { _id: old, lastSentAt: new Date(Date.now() - 9 * day) },
        ];
    };
    NudgeLog.findOne = () => { throw new Error('per-user findOne must not be used'); };

    const eligible = (await getInactivityEligible()).map((e) => e.userId).sort();

    assert.equal(aggregates, 1);
    assert.deepEqual(eligible, [String(old), String(never)].sort());
});
