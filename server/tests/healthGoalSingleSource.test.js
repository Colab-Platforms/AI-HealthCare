/**
 * One stored goal (26 Nov): User.nutritionGoal is removed; HealthGoal holds
 * the goal and every daily target. Covers the pace rule (target date ->
 * the user's picked pace -> 12 weeks), the nutritionGoal-shaped view the
 * app still reads, the diabetes flag, and healthGoalService.syncGoal.
 * No DB (model methods + mocked queries).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const HealthGoal = require('../models/HealthGoal');
const User = require('../models/User');
const svc = require('../services/healthGoalService');

const USER = new mongoose.Types.ObjectId();
// Staging persona b: 67, female, 158 cm, 85 kg, lightly active, diabetic, wants 76 kg at 0.25 kg/week.
const B = { userId: USER, goalType: 'weight_loss', currentWeight: 85, targetWeight: 76, height: 158, age: 67, gender: 'female', activityLevel: 'lightly_active' };

test('User schema no longer has nutritionGoal', () => {
    assert.equal(User.schema.path('nutritionGoal'), undefined);
    assert.equal(User.schema.path('nutritionGoal.calorieGoal'), undefined);
});

test('pace: the picked weeklyGoal is used when there is no target date (was: 12 weeks -> 0.75 kg/week, 1476 kcal floor)', () => {
    const picked = HealthGoal.computeDraft({ ...B, isDiabetic: true, weeklyGoal: 0.25 });
    assert.equal(picked.weeklyRateKg, -0.25);
    assert.equal(picked.dailyCalorieTarget, 1625); // same as the old signup number
    const noPace = HealthGoal.computeDraft({ ...B, isDiabetic: true });
    assert.equal(noPace.dailyCalorieTarget, 1476); // 12-week default kept when nothing was picked
});

test('pace: a real target date wins over weeklyGoal; the safety cap still applies', () => {
    const in36Weeks = new Date(Date.now() + 36 * 7 * 86400000);
    const dated = HealthGoal.computeDraft({ ...B, weeklyGoal: 1, targetDate: in36Weeks });
    assert.ok(Math.abs(dated.weeklyRateKg + 0.25) < 0.01);
    const tooFast = HealthGoal.computeDraft({ ...B, weeklyGoal: 2 });
    assert.equal(tooFast.weeklyRateKg, -0.85); // capped at 1% of 85 kg
});

test('consent check uses the same pace rule (no false "unsafe" for a picked 0.25 kg/week)', () => {
    const picked = HealthGoal.checkRequestedRate({ ...B, weeklyGoal: 0.25 });
    assert.equal(picked.isUnsafe, false);
    assert.equal(picked.requestedWeeklyRate, -0.25);
    assert.equal(picked.timeframeReceived, true);
    const none = HealthGoal.checkRequestedRate({ ...B });
    assert.equal(none.timeframeReceived, false);
    assert.equal(none.weeksUsed, 12);
});

test('toNutritionGoal: the old field shape, built from HealthGoal', () => {
    const g = HealthGoal.computeDraft({ ...B, weeklyGoal: 0.25, isDiabetic: true });
    const ng = HealthGoal.toNutritionGoal(g);
    assert.equal(ng.goal, 'weight_loss');
    assert.equal(ng.targetWeight, 76);
    assert.equal(ng.weeklyGoal, 0.25);
    assert.equal(ng.calorieGoal, g.dailyCalorieTarget);
    assert.equal(ng.proteinGoal, g.macroTargets.protein);
    assert.equal(ng.carbsGoal, g.macroTargets.carbs);
    assert.equal(ng.fatGoal, g.macroTargets.fats);
    assert.equal(ng.autoCalculated, true);
    assert.equal(HealthGoal.toNutritionGoal(null), null);
    assert.equal(HealthGoal.toNutritionGoal({ ...g.toObject(), calorieSource: 'manual' }).autoCalculated, false);
});

test('diabetes flag: every place the profile can say it', () => {
    assert.equal(svc.isDiabeticProfile({ isDiabetic: 'yes' }), true);
    assert.equal(svc.isDiabeticProfile({ healthConditions: ['Diabetes'] }), true);
    assert.equal(svc.isDiabeticProfile({ chronicConditions: ['Type 2 Diabetes'] }), true);
    assert.equal(svc.isDiabeticProfile({ medicalHistory: { conditions: ['diabetic'] } }), true);
    assert.equal(svc.isDiabeticProfile({ isDiabetic: 'no', healthConditions: ['Thyroid'] }), false);
    assert.equal(svc.isDiabeticProfile({}), false);
});

test('bodyFrom: invalid gender / activity are dropped, not saved', () => {
    const b = svc.bodyFrom({ age: 30, gender: 'robot', height: 170, weight: 70, activityLevel: 'couch' });
    assert.equal(b.gender, undefined);
    assert.equal(b.activityLevel, undefined);
    assert.equal(svc.bodyFrom({ age: '30', height: '170', weight: '70' }).age, 30);
});

// syncGoal with the query + save mocked.
function mockGoalQueries(t, existing) {
    const saved = [];
    t.mock.method(HealthGoal, 'findOne', () => ({ sort: async () => existing }));
    t.mock.method(HealthGoal.prototype, 'save', async function save() {
        // run the real pre-save maths without a DB
        this.calculateBMR(); this.calculateTDEE(); this.calculateCalorieTarget(); this.calculateMacros();
        saved.push(this);
        return this;
    });
    const cache = require('../utils/cache');
    t.mock.method(cache, 'delete', async () => {});
    return saved;
}

test('syncGoal: incomplete profile -> no goal (nothing to calculate from)', async (t) => {
    const saved = mockGoalQueries(t, null);
    assert.equal(await svc.syncGoal(USER, { profile: { age: 30, gender: 'male' }, input: { goal: 'weight_loss' } }), null);
    assert.equal(saved.length, 0);
});

test('syncGoal: onboarding creates the goal with the picked pace, activity and diabetes flag', async (t) => {
    const saved = mockGoalQueries(t, null);
    const profile = { age: 67, gender: 'female', height: 158, weight: 85, activityLevel: 'lightly_active', isDiabetic: 'yes' };
    const goal = await svc.syncGoal(USER, { profile, input: { goal: 'weight_loss', targetWeight: 76, weeklyGoal: 0.25 }, create: true });
    assert.equal(saved.length, 1);
    assert.equal(goal.goalType, 'weight_loss');
    assert.equal(goal.weeklyGoal, 0.25);
    assert.equal(goal.isDiabetic, true);
    assert.equal(goal.activityLevel, 'lightly_active');
    assert.equal(goal.dailyCalorieTarget, 1625);
});

test('syncGoal: onboarding without a pace -> 0.5 kg/week default; without a goal input and no goal -> nothing created', async (t) => {
    const saved = mockGoalQueries(t, null);
    const profile = { age: 30, gender: 'male', height: 175, weight: 80 };
    const goal = await svc.syncGoal(USER, { profile, input: { goal: 'weight_loss', targetWeight: 72 } });
    assert.equal(goal.weeklyGoal, svc.DEFAULT_WEEKLY_GOAL);
    assert.equal(await svc.syncGoal(USER, { profile }), null);
    assert.equal(saved.length, 1);
});

test('syncGoal: an existing goal follows the profile (weight, diabetes) and keeps its own goal / pace / manual target', async (t) => {
    const existing = new HealthGoal({ ...B, weeklyGoal: 0.25, calorieSource: 'manual', manualCalorieTarget: 1700 });
    mockGoalQueries(t, existing);
    const goal = await svc.syncGoal(USER, { profile: { age: 67, gender: 'female', height: 158, weight: 83, healthConditions: ['Diabetes'] } });
    assert.equal(goal.currentWeight, 83);
    assert.equal(goal.isDiabetic, true);
    assert.equal(goal.goalType, 'weight_loss');
    assert.equal(goal.weeklyGoal, 0.25);
    assert.equal(goal.calorieSource, 'manual');
});

test('syncGoal: a goal that fails validation is logged, never thrown', async (t) => {
    mockGoalQueries(t, null);
    t.mock.method(HealthGoal.prototype, 'save', async () => { throw new Error('Weight must be at least 30kg'); });
    const errors = [];
    const goal = await svc.syncGoal(USER, { profile: { age: 30, gender: 'male', height: 175, weight: 25 }, input: { goal: 'weight_gain' }, logger: { error: (m) => errors.push(m) } });
    assert.equal(goal, null);
    assert.match(errors[0], /goal not saved/);
});
