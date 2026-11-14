const test = require('node:test');
const assert = require('node:assert/strict');

const { _internal } = require('../services/shopifyOfferService');

const { decideOffer, offerFields, hasActivePaidPlan } = _internal;

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-06T12:00:00Z');
const at = (iso) => new Date(iso);
const days = (a, b) => Math.round((b - a) / DAY);

const trialUser = (createdAt, trialEnd) => ({
    createdAt: at(createdAt),
    subscription: { plan: 'free_trial', status: 'active', startDate: at(createdAt), currentPeriodEnd: at(trialEnd) },
});

test('A: on the 14-day trial, bought after joining -> +30 days after the trial ends (Rahul)', () => {
    const user = trialUser('2026-11-01T12:00:00Z', '2026-11-15T12:00:00Z');
    const d = decideOffer(user, { orderCreatedAt: at('2026-11-04T12:00:00Z') }, NOW, 30);
    assert.equal(d.kind, 'applied');
    assert.equal(d.end.toISOString(), '2026-12-15T12:00:00.000Z');
    assert.equal(d.keepStart, true);
});

test('B: bought first, joined later -> 30 days from joining, NOT 14 + 30 (Priya)', () => {
    const user = trialUser('2026-11-06T12:00:00Z', '2026-11-20T12:00:00Z'); // signup just gave 14 days
    const d = decideOffer(user, { orderCreatedAt: at('2026-11-02T12:00:00Z') }, NOW, 30);
    assert.equal(d.kind, 'applied');
    assert.equal(d.end.toISOString(), '2026-12-06T12:00:00.000Z');
    assert.equal(days(user.createdAt, d.end), 30, 'total access must be 30 days, not 44');
});

test('B, redeemed a few days after joining: still 30 days counted from joining', () => {
    const user = trialUser('2026-11-02T12:00:00Z', '2026-11-16T12:00:00Z');
    const d = decideOffer(user, { orderCreatedAt: at('2026-11-01T12:00:00Z') }, NOW, 30);
    assert.equal(d.end.toISOString(), '2026-12-02T12:00:00.000Z');
});

test('C: trial already over -> 30 days from today (Amit)', () => {
    const user = {
        createdAt: at('2026-09-01T12:00:00Z'),
        subscription: { plan: 'free', status: 'expired', currentPeriodEnd: at('2026-09-15T12:00:00Z') },
    };
    const d = decideOffer(user, { orderCreatedAt: at('2026-11-05T12:00:00Z') }, NOW, 30);
    assert.equal(d.kind, 'applied');
    assert.equal(d.end.toISOString(), '2026-12-06T12:00:00.000Z');
    assert.equal(d.keepStart, false);
});

test('C: a free_trial whose end date already passed (cron not run yet) counts as over', () => {
    const user = trialUser('2026-10-01T12:00:00Z', '2026-10-15T12:00:00Z');
    const d = decideOffer(user, { orderCreatedAt: at('2026-11-05T12:00:00Z') }, NOW, 30);
    assert.equal(d.end.toISOString(), '2026-12-06T12:00:00.000Z');
});

test('D: live paid plan -> pending (applied by the lifecycle cron after the plan ends)', () => {
    const user = {
        createdAt: at('2026-06-01T12:00:00Z'),
        subscription: { plan: 'take_plus', status: 'active', currentPeriodEnd: at('2026-12-01T12:00:00Z') },
    };
    assert.equal(hasActivePaidPlan(user.subscription), true);
    assert.deepEqual(decideOffer(user, { orderCreatedAt: at('2026-11-05T12:00:00Z') }, NOW, 30), { kind: 'pending' });
});

test('D: a paid plan whose period already ended is treated like C, not pending', () => {
    const sub = { plan: 'take_plus', status: 'active', currentPeriodEnd: at('2026-11-01T12:00:00Z') };
    assert.equal(hasActivePaidPlan(sub), false);
    const d = decideOffer({ createdAt: at('2026-06-01T12:00:00Z'), subscription: sub }, { orderCreatedAt: at('2026-11-05T12:00:00Z') }, NOW, 30);
    assert.equal(d.kind, 'applied');
});

test('D: a running offer grant is not a paid plan (a second grant is never "pending")', () => {
    const sub = { plan: 'take_plus', grantSource: 'shopify_offer', status: 'active', currentPeriodEnd: at('2026-12-01T12:00:00Z') };
    assert.equal(hasActivePaidPlan(sub), false);
});

test('offer fields give take_plus marked as the Shopify grant and re-arm the ending email', () => {
    const end = at('2026-12-06T12:00:00Z');
    const f = offerFields(end, NOW, false);
    assert.equal(f['subscription.plan'], 'take_plus');
    assert.equal(f['subscription.grantSource'], 'shopify_offer');
    assert.equal(f['subscription.autoRenew'], false);
    assert.equal(f['subscription.status'], 'active');
    assert.equal(f['subscription.currentPeriodEnd'], end);
    assert.equal(f['subscription.endDate'], end);
    assert.equal(f['subscription.renewalReminderSentAt'], null);
    assert.equal(f['subscription.startDate'], NOW);
    assert.equal('subscription.startDate' in offerFields(end, NOW, true), false, 'a running trial keeps its start date');
});
