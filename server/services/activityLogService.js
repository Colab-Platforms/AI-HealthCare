// Water, sleep, smoke and alcohol logging, shared by the app's endpoints and
// the AI coach (25 Nov: "coach ko log karne do"). Moved out of the controllers
// unchanged so a log from chat is exactly a log from the app: same documents,
// same cache clears, same score recompute, same gamification.
//
//   setWaterTotal(userId, totalMl, dateKey)        nutritionController.logWater
//   getWaterTotal(userId, dateKey)
//   saveSleep(userId, { deviceType, sleepData, isAdditive })   wearableController.addSleepData
//   addSmokes(userId, { count, dateKey })           atomic append (the app's PUT replaces the whole log)
//   logAlcoholDrink(userId, body)                   healthController.logAlcoholSession

const User = require('../models/User');
const NutritionSummary = require('../models/NutritionSummary');
const WearableData = require('../models/WearableData');
const SleepSession = require('../models/SleepSession');
const cache = require('../utils/cache');
const { logActivity } = require('../utils/activityLogger');
const { isValidDrinkType, getSizeDefaults } = require('../config/drinkCatalog');
const { validateDrinkInput, sanitizeSession, toPlainAlcoholLog, getTodayKey, DATE_KEY_RE } = require('../utils/alcoholLog');

class ActivityLogError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const dateOnlyUTCFromDate = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const recompute = () => require('../utils/scoreRecompute');

// ── water ──────────────────────────────────────────────────────────────────

function waterDate(dateKey) {
    const queryDate = dateKey ? new Date(dateKey) : new Date();
    const targetDate = new Date(queryDate.toISOString().split('T')[0]);
    targetDate.setUTCHours(0, 0, 0, 0);
    return targetDate;
}

async function getWaterTotal(userId, dateKey) {
    const row = await NutritionSummary.findOne({ userId, date: waterDate(dateKey) }).select('waterIntake').lean();
    return Number(row?.waterIntake) || 0;
}

// Sets the day's TOTAL (ml), like the app's water screen does.
async function setWaterTotal(userId, totalMl, dateKey) {
    const waterAmount = Number(totalMl);
    if (!Number.isFinite(waterAmount) || waterAmount < 0) {
        throw new ActivityLogError(400, 'waterIntake must be a finite number greater than or equal to 0');
    }
    const targetDate = waterDate(dateKey);

    // Atomic get-or-create (see the comment this came from in nutritionController):
    // two concurrent requests can't both insert and trip the userId+date unique index.
    const summary = await NutritionSummary.findOneAndUpdate(
        { userId, date: targetDate },
        { $setOnInsert: { userId, date: targetDate } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    summary.waterIntake = waterAmount;
    await summary.save();

    const dateStr = targetDate.toISOString().split('T')[0];
    recompute().triggerDailyScoreRecompute(userId, dateStr);
    const DailyProgress = require('../models/DailyProgress');
    await DailyProgress.findOneAndUpdate(
        { userId, date: dateStr },
        { waterIntake: waterAmount },
        { upsert: true, new: true },
    );

    cache.delete(`dashboard:${userId}`);
    cache.deletePattern(`water_analytics:${userId}:*`);

    const gamificationService = require('./gamificationService');
    const gamification = await gamificationService.awardPoints(userId, 'water_intake', 'Logged water intake').catch((err) => {
        console.error('Gamification Error:', err);
        return null;
    });
    return { totalMl: summary.waterIntake, gamification };
}

async function getGlassSizeMl(userId) {
    const user = await User.findById(userId).select('profile.lifestyle.waterGlassSizeMl').lean();
    return user?.profile?.lifestyle?.waterGlassSizeMl || 250;
}

// ── sleep ──────────────────────────────────────────────────────────────────

async function saveSleep(userId, { deviceType = 'manual', sleepData, isAdditive = false }) {
    if (!sleepData || typeof sleepData !== 'object') throw new ActivityLogError(400, 'sleepData is required');

    let wearable = await WearableData.findOne({ user: userId, deviceType });
    if (!wearable) {
        if (deviceType === 'manual') {
            wearable = await WearableData.create({
                user: userId,
                deviceType: 'manual',
                deviceName: 'Manual Entry',
                isConnected: false,
                sleepData: [],
            });
        } else {
            throw new ActivityLogError(404, 'Device not connected');
        }
    }

    // Parse date strings like "2026-03-13" as UTC directly to avoid timezone shift
    let targetDate;
    if (sleepData.date && typeof sleepData.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sleepData.date)) {
        const [y, m, d] = sleepData.date.split('-').map(Number);
        targetDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    } else {
        targetDate = sleepData.date ? new Date(sleepData.date) : new Date();
        targetDate.setUTCHours(0, 0, 0, 0);
    }
    const targetDateString = targetDate.toISOString().split('T')[0];

    // Coerce all numeric fields to numbers before saving
    if (sleepData.totalSleepMinutes !== undefined) sleepData.totalSleepMinutes = Number(sleepData.totalSleepMinutes) || 0;
    if (sleepData.deepSleepMinutes !== undefined) sleepData.deepSleepMinutes = Number(sleepData.deepSleepMinutes) || 0;
    if (sleepData.lightSleepMinutes !== undefined) sleepData.lightSleepMinutes = Number(sleepData.lightSleepMinutes) || 0;
    if (sleepData.remSleepMinutes !== undefined) sleepData.remSleepMinutes = Number(sleepData.remSleepMinutes) || 0;
    if (sleepData.awakeMinutes !== undefined) sleepData.awakeMinutes = Number(sleepData.awakeMinutes) || 0;

    const existingIndex = wearable.sleepData.findIndex((s) => {
        const d = new Date(s.date);
        return d.getUTCFullYear() === targetDate.getUTCFullYear()
            && d.getUTCMonth() === targetDate.getUTCMonth()
            && d.getUTCDate() === targetDate.getUTCDate();
    });

    if (existingIndex >= 0) {
        const existing = wearable.sleepData[existingIndex].toObject();
        const updatedSleep = { ...existing, ...sleepData };

        // If additive flag is present, add totalSleepMinutes/remSleepMinutes etc instead of replacing
        if (isAdditive) {
            if (sleepData.totalSleepMinutes !== undefined) updatedSleep.totalSleepMinutes = (existing.totalSleepMinutes || 0) + Number(sleepData.totalSleepMinutes);
            if (sleepData.remSleepMinutes !== undefined) updatedSleep.remSleepMinutes = (existing.remSleepMinutes || 0) + Number(sleepData.remSleepMinutes);
            if (sleepData.deepSleepMinutes !== undefined) updatedSleep.deepSleepMinutes = (existing.deepSleepMinutes || 0) + Number(sleepData.deepSleepMinutes);
        }

        wearable.sleepData[existingIndex] = { ...updatedSleep, date: targetDate };
        wearable.markModified('sleepData');
    } else {
        wearable.sleepData.push({ ...sleepData, date: targetDate });
    }

    await wearable.save();

    // Mirror the resolved entry into SleepSession: sleepAnalyticsService reads from there.
    const resolvedSleep = wearable.sleepData.find((s) => dateOnlyUTCFromDate(new Date(s.date)).getTime() === targetDate.getTime());
    if (resolvedSleep) {
        await SleepSession.findOneAndUpdate(
            { user: userId, deviceType, date: targetDate },
            { $set: {
                totalSleepMinutes: resolvedSleep.totalSleepMinutes,
                deepSleepMinutes: resolvedSleep.deepSleepMinutes,
                lightSleepMinutes: resolvedSleep.lightSleepMinutes,
                remSleepMinutes: resolvedSleep.remSleepMinutes,
                awakeMinutes: resolvedSleep.awakeMinutes,
                sleepScore: resolvedSleep.sleepScore,
                bedTime: resolvedSleep.bedTime,
                wakeTime: resolvedSleep.wakeTime,
                source: deviceType,
            } },
            { upsert: true },
        );
    }

    await logActivity(userId, 'LOG_SLEEP_DATA', 'fitness', {
        deviceType,
        totalSleepMinutes: sleepData.totalSleepMinutes,
        remSleepMinutes: sleepData.remSleepMinutes,
        deepSleepMinutes: sleepData.deepSleepMinutes,
    });

    cache.delete(`dashboard:${userId}`);
    cache.deletePattern(`sleep_analytics:${userId}:*`);
    recompute().triggerDailyScoreRecompute(userId, targetDateString);
    recompute().triggerRecoveryScoreRecompute(userId, targetDateString);

    return wearable;
}

// ── smoke ──────────────────────────────────────────────────────────────────

// Same day entry shape as the app's smoke log ({ count, resistedCount, sessions }),
// appended atomically so it can't clobber a log the app saves at the same time.
async function addSmokes(userId, { count, dateKey }) {
    const n = Math.round(Number(count));
    if (!Number.isFinite(n) || n < 1 || n > 100) throw new ActivityLogError(400, 'count must be between 1 and 100');
    if (!DATE_KEY_RE.test(dateKey || '')) throw new ActivityLogError(400, 'dateKey must be YYYY-MM-DD');
    const time = new Date().toISOString();
    const session = { time, count: n, trigger: null, id: time };
    const user = await User.findByIdAndUpdate(
        userId,
        { $push: { [`smokeLog.${dateKey}.sessions`]: session }, $inc: { [`smokeLog.${dateKey}.count`]: n } },
        { new: true, runValidators: false },
    ).select('smokeLog');
    if (!user) throw new ActivityLogError(404, 'User not found');
    await cache.delete(`dashboard:${userId}`);
    recompute().triggerDailyScoreRecompute(userId);
    const day = (user.smokeLog || {})[dateKey] || {};
    return { session, dayCount: Number(day.count) || n };
}

// ── alcohol ────────────────────────────────────────────────────────────────

// Validation and append from healthController.logAlcoholSession, unchanged.
// Returns { session, day } or throws ActivityLogError(400 / 404).
async function logAlcoholDrink(userId, { drinkType, size, volumeMl: rawVolumeMl, abv: rawAbv, name, context, mood, notes, date } = {}) {
    if (!drinkType || !isValidDrinkType(drinkType)) throw new ActivityLogError(400, 'Invalid or missing drinkType');

    let volumeMl = rawVolumeMl;
    let abv = rawAbv;
    if (drinkType === 'other') {
        // No catalog defaults for an unknown drink: refusing to guess is the point of 'other'.
        if (volumeMl === undefined || abv === undefined) throw new ActivityLogError(400, 'volumeMl and abv are required when drinkType is "other"');
    } else if (size) {
        const defaults = getSizeDefaults(drinkType, size);
        if (!defaults) throw new ActivityLogError(400, `Invalid size "${size}" for drinkType "${drinkType}"`);
        volumeMl = volumeMl ?? defaults.volumeMl;
        abv = abv ?? defaults.defaultAbv;
    } else if (volumeMl === undefined || abv === undefined) {
        throw new ActivityLogError(400, 'Provide either size or explicit volumeMl + abv');
    }

    // Reject out-of-range values instead of clamping: a typo must surface as an error.
    const validationError = validateDrinkInput(volumeMl, abv);
    if (validationError) throw new ActivityLogError(400, validationError);

    const session = sanitizeSession({ drinkType, volumeMl, abv, name, context, mood, notes, time: new Date().toISOString() });
    const dateKey = date && DATE_KEY_RE.test(date) ? date : getTodayKey();
    const path = `alcoholLog.${dateKey}`;

    const user = await User.findByIdAndUpdate(
        userId,
        {
            $push: { [`${path}.sessions`]: session },
            $inc: {
                [`${path}.count`]: 1,
                [`${path}.units`]: session.units,
                [`${path}.totalVolumeMl`]: session.volumeMl || 0,
            },
        },
        { new: true, upsert: false, runValidators: false },
    ).select('alcoholLog');
    if (!user) throw new ActivityLogError(404, 'User not found');

    await cache.delete(`dashboard:${userId}`);
    recompute().triggerDailyScoreRecompute(userId);
    return { session, day: toPlainAlcoholLog(user.alcoholLog)[dateKey] };
}

module.exports = { ActivityLogError, getWaterTotal, setWaterTotal, getGlassSizeMl, saveSleep, addSmokes, logAlcoholDrink };
