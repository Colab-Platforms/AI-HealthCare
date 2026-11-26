// Logging a weight reading: one implementation for the app's weight log
// (POST /api/nutrition/log-weight) and the AI coach ("I'm 58 kg now").
// Moved out of nutritionController.logWeight unchanged, so both paths write
// the same things:
//   - HealthMetric 'weight' (one per UTC day, updated if it exists) -> weight graph / history
//   - HealthProfile body.weightKg (mirrored to User.profile.weight) + healthMetrics.bmi
//   - active HealthGoal currentWeight + weeklyWeightLogs, recalculated targets
//   - dashboard / health-goal caches cleared
// Input must already be validated (0 < weightKg <= 500).

const HealthMetric = require('../models/HealthMetric');
const HealthGoal = require('../models/HealthGoal');
const User = require('../models/User');
const cache = require('../utils/cache');
const profileSync = require('../modules/health-profile/services/profileSync');

// "2026-03-13" is taken as that UTC day (no timezone shift); anything else as a Date.
function parseRecordedDate(date) {
    if (date && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [y, m, d] = date.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    }
    return date ? new Date(date) : new Date();
}

async function logWeight({ userId, weightKg, date, notes, source = 'manual' }) {
    const recordedDate = parseRecordedDate(date);

    // Same UTC day already logged: update it instead of adding a duplicate.
    let metric = await HealthMetric.findOne({
        userId,
        type: 'weight',
        recordedAt: {
            $gte: new Date(new Date(recordedDate).setUTCHours(0, 0, 0, 0)),
            $lt: new Date(new Date(recordedDate).setUTCHours(23, 59, 59, 999)),
        },
    }).maxTimeMS(30000);

    const created = !metric;
    const previousValue = metric ? metric.value : null;
    if (metric) {
        metric.value = weightKg;
        metric.notes = notes;
    } else {
        metric = new HealthMetric({
            userId,
            type: 'weight',
            value: weightKg,
            unit: 'kg',
            readingContext: 'general',
            recordedAt: recordedDate,
            notes,
        });
    }
    await metric.save({ maxTimeMS: 30000 });

    // Profile weight (through HealthProfile) and BMI, together.
    const user = await User.findById(userId).select('profile.height').lean().maxTimeMS(30000);
    if (user) {
        const height = user.profile?.height;
        const bmiPatch = height
            ? { $set: { 'healthMetrics.bmi': Number((weightKg / Math.pow(height / 100, 2)).toFixed(1)) } }
            : {};
        await profileSync.writeWithUser(userId, { body: { weightKg } }, bmiPatch, { source });
    }

    const healthGoal = await HealthGoal.findOne({ userId }).maxTimeMS(30000);
    if (healthGoal) {
        healthGoal.currentWeight = weightKg;
        healthGoal.weeklyWeightLogs.push({ weight: weightKg, date: new Date(), notes });
        await healthGoal.save({ maxTimeMS: 30000 }); // pre-save recalculates targets (the only stored targets)

        await profileSync.writeWithUser(userId, {
            goals: { targetWeightKg: profileSync.positiveNumber(healthGoal.targetWeight) },
        }, {}, { source });
    }

    cache.delete(`dashboard:${userId}`);
    cache.delete(`health_goal:${userId}`);

    // `created`: false when the day's existing reading was updated (an undo
    // must then not delete the user's own earlier entry); `previousValue`:
    // that entry's value before this call, so an undo can put it back.
    return { metric, healthGoal, created, previousValue };
}

module.exports = { logWeight, parseRecordedDate };
