const ExerciseLog = require('../models/ExerciseLog');
const ExerciseSummary = require('../models/ExerciseSummary');
const NutritionSummary = require('../models/NutritionSummary');
const FitnessGoal = require('../models/FitnessGoal');
const User = require('../models/User');
const cache = require('../utils/cache');
const { logActivity } = require('../utils/activityLogger');
const gamificationService = require('../services/gamificationService');
const { triggerDailyScoreRecompute } = require('../utils/scoreRecompute');
const { getHeartRateSamplesInRange } = require('../services/wearableHeartRateService');
const { estimateMaxHR, computeZones, summarizeHeartRate } = require('../utils/heartRateZones');
const { estimateSteps, estimateAvgPace, computeSessionVolumeKg } = require('../utils/exerciseEstimates');
const { isValidActivityId, groupCatalog } = require('../config/activityCatalog');
const { calculateDailyScore } = require('../services/dailyHealthScoreService');

const DEFAULT_WEEKLY_GOAL = { weeklyMinutesTarget: 150, weeklyCaloriesTarget: 2000, weeklyDistanceKmTarget: 10 };

async function getCachedUserAge(userId) {
  const cacheKey = `user_age:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached;
  const user = await User.findById(userId).select('profile.age').lean();
  const age = user?.profile?.age || 0;
  await cache.set(cacheKey, age, 15 * 60);
  return age;
}

/**
 * Builds HR fields (avg/min/max/zones) for a session window from wearable samples,
 * only for values the caller didn't already supply manually.
 * @returns {Promise<{fields: object, usedWearable: boolean}>}
 */
async function resolveHeartRateForWindow(userId, startTime, endTime, manualFields) {
  const fields = {};
  let usedWearable = false;

  if (!startTime || !endTime) return { fields, usedWearable };

  const samples = await getHeartRateSamplesInRange(userId, startTime, endTime);
  if (samples.length === 0) return { fields, usedWearable };

  const summary = summarizeHeartRate(samples);
  if (!summary) return { fields, usedWearable };

  if (manualFields.avgHeartRate === undefined) { fields.avgHeartRate = summary.avg; usedWearable = true; }
  if (manualFields.minHeartRate === undefined) { fields.minHeartRate = summary.min; usedWearable = true; }
  if (manualFields.maxHeartRate === undefined) { fields.maxHeartRate = summary.max; usedWearable = true; }

  if (usedWearable) {
    const age = await getCachedUserAge(userId);
    fields.heartRateZones = computeZones(samples, estimateMaxHR(age));
  }

  return { fields, usedWearable };
}

// Helper function to add timeout to all queries for Vercel compatibility
// Query objects expose .maxTimeMS(); Aggregate objects only expose .option({ maxTimeMS })
const withTimeout = (query, timeoutMs = 30000) => {
  if (typeof query.maxTimeMS === 'function') return query.maxTimeMS(timeoutMs);
  return query.option({ maxTimeMS: timeoutMs });
};

function parseDayParam(dateInput) {
  let targetDate;
  if (dateInput instanceof Date) {
    targetDate = new Date(dateInput.toISOString().split('T')[0]);
  } else if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    targetDate = new Date(dateInput.split('T')[0]);
  } else {
    targetDate = new Date(new Date(dateInput).toISOString().split('T')[0]);
  }
  targetDate.setUTCHours(0, 0, 0, 0);
  return targetDate;
}

async function getCachedUserWeight(userId) {
  const cacheKey = `user_weight:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached;
  const user = await User.findById(userId).select('profile.weight').lean();
  const weight = user?.profile?.weight || 0;
  await cache.set(cacheKey, weight, 15 * 60);
  return weight;
}

// Log a new exercise session
exports.logExercise = async (req, res) => {
  try {
    const {
      activityType,
      duration,
      distance,
      avgPace,
      avgHeartRate,
      minHeartRate,
      maxHeartRate,
      elevationGain,
      exercises,
      intensity,
      notes,
      timestamp,
      startTime,
      endTime,
      caloriesBurned: manualCalories
    } = req.body;

    if (!activityType || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Activity type and duration are required'
      });
    }

    if (!isValidActivityId(activityType)) {
      return res.status(400).json({
        success: false,
        message: `Unknown activity type: ${activityType}`
      });
    }

    const weightKg = await getCachedUserWeight(req.user._id);
    const { calories, metValue } = ExerciseLog.calculateCalories(activityType, intensity, duration, weightKg);

    const resolvedAvgPace = avgPace !== undefined ? Number(avgPace) : estimateAvgPace(duration, distance);
    const resolvedSteps = req.body.steps !== undefined
      ? Number(req.body.steps)
      : estimateSteps(activityType, distance);

    const manualHrFields = { avgHeartRate, minHeartRate, maxHeartRate };
    const { fields: wearableHrFields, usedWearable } = await resolveHeartRateForWindow(
      req.user._id, startTime, endTime, manualHrFields
    );

    const hasManualHr = avgHeartRate !== undefined || minHeartRate !== undefined || maxHeartRate !== undefined;
    let source = 'manual';
    if (usedWearable) source = hasManualHr ? 'hybrid' : 'wearable_sync';

    const exerciseLog = new ExerciseLog({
      userId: req.user._id,
      activityType,
      duration: Number(duration),
      distance: distance !== undefined ? Number(distance) : undefined,
      avgPace: resolvedAvgPace,
      steps: resolvedSteps,
      avgHeartRate: avgHeartRate !== undefined ? Number(avgHeartRate) : wearableHrFields.avgHeartRate,
      minHeartRate: minHeartRate !== undefined ? Number(minHeartRate) : wearableHrFields.minHeartRate,
      maxHeartRate: maxHeartRate !== undefined ? Number(maxHeartRate) : wearableHrFields.maxHeartRate,
      heartRateZones: wearableHrFields.heartRateZones,
      elevationGain: elevationGain !== undefined ? Number(elevationGain) : undefined,
      exercises: Array.isArray(exercises) ? exercises : undefined,
      intensity: intensity || 'medium',
      notes,
      source,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      caloriesBurned: Number(manualCalories) > 0 ? Number(manualCalories) : calories,
      metValue,
      timestamp: (() => {
        if (startTime) return new Date(startTime);
        const inputDate = timestamp || req.body.date;
        if (inputDate && typeof inputDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
          const [y, m, d] = inputDate.split('-').map(Number);
          return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        }
        return inputDate ? new Date(inputDate) : new Date();
      })()
    });

    await exerciseLog.save();

    await updateDailyExerciseSummary(req.user._id, exerciseLog.timestamp);

    await logActivity(req.user._id, 'LOG_EXERCISE', 'fitness', {
      activityType,
      duration: exerciseLog.duration,
      caloriesBurned: exerciseLog.caloriesBurned
    }, req);

    const gamificationResult = await gamificationService
      .awardPoints(req.user._id, 'workout', `Logged ${activityType.replace('_', ' ')}`, activityType)
      .catch((err) => {
        console.error('Gamification Error:', err);
        return null;
      });

    res.json({
      success: true,
      exerciseLog,
      gamification: gamificationResult,
      message: 'Exercise logged successfully'
    });
  } catch (error) {
    console.error('Log exercise error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log exercise',
      error: error.message
    });
  }
};

// Preview computed HR (avg/min/max/zones) for a time window from wearable data,
// before the user submits the log
exports.previewHeartRate = async (req, res) => {
  try {
    const { startTime, endTime } = req.query;
    if (!startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'startTime and endTime are required' });
    }

    const samples = await getHeartRateSamplesInRange(req.user._id, startTime, endTime);
    if (samples.length === 0) {
      return res.json({ success: true, found: false });
    }

    const summary = summarizeHeartRate(samples);
    const age = await getCachedUserAge(req.user._id);
    const heartRateZones = computeZones(samples, estimateMaxHR(age));

    res.json({
      success: true,
      found: true,
      avgHeartRate: summary.avg,
      minHeartRate: summary.min,
      maxHeartRate: summary.max,
      heartRateZones,
      sampleCount: samples.length
    });
  } catch (error) {
    console.error('Preview heart rate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview heart rate',
      error: error.message
    });
  }
};

// Grouped activity catalog for the activity picker, plus the user's most-logged
// activity types in the last 30 days as "recents"
exports.getActivityCatalog = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAgg = await withTimeout(ExerciseLog.aggregate([
      { $match: { userId: req.user._id, timestamp: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$activityType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 }
    ]));

    const { groups, other } = groupCatalog();

    res.json({
      success: true,
      groups,
      other,
      recents: recentAgg.map((r) => r._id)
    });
  } catch (error) {
    console.error('Get activity catalog error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get activity catalog',
      error: error.message
    });
  }
};

// Get exercise logs (paginated, filterable)
exports.getExerciseLogs = async (req, res) => {
  try {
    const { startDate, endDate, activityType, date, page, limit: limitParam } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limitParam) || 20));
    const skip = (pageNum - 1) * pageSize;

    const query = { userId: req.user._id };

    if (date) {
      const [y, m, d] = date.split('-').map(Number);
      const d0 = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      const nextDay = new Date(d0);
      nextDay.setUTCDate(d0.getUTCDate() + 1);
      query.timestamp = { $gte: d0, $lt: nextDay };
    } else if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (activityType) query.activityType = activityType;

    const [exerciseLogs, total] = await Promise.all([
      withTimeout(ExerciseLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(pageSize).lean()),
      ExerciseLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      exerciseLogs,
      count: exerciseLogs.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Get exercise logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get exercise logs',
      error: error.message
    });
  }
};

// Get today's exercise logs
exports.getTodayLogs = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const exerciseLogs = await withTimeout(ExerciseLog.find({
      userId: req.user._id,
      timestamp: { $gte: today, $lt: tomorrow }
    }).sort({ timestamp: 1 }));

    res.json({
      success: true,
      exerciseLogs,
      count: exerciseLogs.length
    });
  } catch (error) {
    console.error('Get today exercise logs error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get today's exercise logs",
      error: error.message
    });
  }
};

// Update exercise log
exports.updateExerciseLog = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.activityType && !isValidActivityId(updates.activityType)) {
      return res.status(400).json({ success: false, message: `Unknown activity type: ${updates.activityType}` });
    }

    const exerciseLog = await ExerciseLog.findOne({ _id: id, userId: req.user._id });

    if (!exerciseLog) {
      return res.status(404).json({ success: false, message: 'Exercise log not found' });
    }

    Object.assign(exerciseLog, updates);

    // Recompute calories if the metrics that drive the estimate changed and no manual override was given
    if ((updates.duration || updates.activityType || updates.intensity) && !updates.caloriesBurned) {
      const weightKg = await getCachedUserWeight(req.user._id);
      const { calories, metValue } = ExerciseLog.calculateCalories(
        exerciseLog.activityType, exerciseLog.intensity, exerciseLog.duration, weightKg
      );
      exerciseLog.caloriesBurned = calories;
      exerciseLog.metValue = metValue;
    }

    await exerciseLog.save();

    await updateDailyExerciseSummary(req.user._id, exerciseLog.timestamp);

    res.json({
      success: true,
      exerciseLog,
      message: 'Exercise log updated successfully'
    });
  } catch (error) {
    console.error('Update exercise log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update exercise log',
      error: error.message
    });
  }
};

// Delete exercise log
exports.deleteExerciseLog = async (req, res) => {
  try {
    const { id } = req.params;

    const exerciseLog = await ExerciseLog.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!exerciseLog) {
      return res.status(404).json({ success: false, message: 'Exercise log not found' });
    }

    await updateDailyExerciseSummary(req.user._id, exerciseLog.timestamp);

    res.json({
      success: true,
      message: 'Exercise log deleted successfully'
    });
  } catch (error) {
    console.error('Delete exercise log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete exercise log',
      error: error.message
    });
  }
};

// Today's unified fitness score for the Fitness analytics page — this is the
// SAME `activity` component that feeds the main unified Health Score
// (dailyHealthScoreService.calculateDailyScore), not a separate formula, so the
// number shown here always agrees with the one baked into the overall score.
exports.getFitnessScore = async (req, res) => {
  try {
    const { date } = req.query;
    const dateStr = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().split('T')[0];

    const daily = await calculateDailyScore(req.user._id, dateStr);

    res.json({
      success: true,
      fitnessScore: daily.components?.activity ?? null,
      date: dateStr,
      isFinalScoreForToday: daily.isFinalScoreForToday,
      dayProgressPercent: daily.dayProgressPercent,
      raw: {
        steps: daily.raw?.steps ?? null,
        stepsGoal: daily.raw?.stepsGoal ?? null,
        activeMinutes: daily.raw?.activeMinutes ?? null,
        activeMinutesGoal: daily.raw?.activeMinutesGoal ?? null,
        exerciseMinutes: daily.raw?.exerciseMinutes ?? null,
        exerciseMinutesGoal: daily.raw?.exerciseMinutesGoal ?? null,
        exerciseSessionsCount: daily.raw?.exerciseSessionsCount ?? null,
        exerciseCaloriesBurned: daily.raw?.exerciseCaloriesBurned ?? null,
      }
    });
  } catch (error) {
    console.error('Get fitness score error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get fitness score',
      error: error.message
    });
  }
};

// Get daily summary
exports.getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = parseDayParam(date || new Date());
    const isToday = targetDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];

    let summary;
    if (isToday) {
      summary = await updateDailyExerciseSummary(req.user._id, targetDate);
    } else {
      summary = await withTimeout(ExerciseSummary.findOne({ userId: req.user._id, date: targetDate }));
      if (!summary) {
        summary = await updateDailyExerciseSummary(req.user._id, targetDate);
      }
    }

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Get exercise daily summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get daily summary',
      error: error.message
    });
  }
};

// Get weekly summary
exports.getWeeklySummary = async (req, res) => {
  try {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const [summaries, goal] = await Promise.all([
      ExerciseSummary.find({
        userId: req.user._id,
        date: { $gte: startDate, $lte: endDate }
      }).sort({ date: 1 }),
      FitnessGoal.findOne({ userId: req.user._id, isActive: true }).lean()
    ]);

    const weeklyStats = {
      totalDuration: 0,
      totalCaloriesBurned: 0,
      totalSessions: 0,
      totalDistance: 0,
      daysActive: summaries.length,
      dailySummaries: summaries
    };

    summaries.forEach((summary) => {
      weeklyStats.totalDuration += summary.totalDuration || 0;
      weeklyStats.totalCaloriesBurned += summary.totalCaloriesBurned || 0;
      weeklyStats.totalSessions += summary.sessionsCount || 0;
      weeklyStats.totalDistance += summary.totalDistance || 0;
    });

    const activeGoal = goal || DEFAULT_WEEKLY_GOAL;
    const progressPct = (value, target) => (target > 0 ? Math.round((value / target) * 100) : null);

    res.json({
      success: true,
      weeklyStats,
      goal: activeGoal,
      progress: {
        minutesPct: progressPct(weeklyStats.totalDuration, activeGoal.weeklyMinutesTarget),
        caloriesPct: progressPct(weeklyStats.totalCaloriesBurned, activeGoal.weeklyCaloriesTarget),
        distancePct: progressPct(weeklyStats.totalDistance, activeGoal.weeklyDistanceKmTarget)
      }
    });
  } catch (error) {
    console.error('Get exercise weekly summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get weekly summary',
      error: error.message
    });
  }
};

// Get the user's active weekly fitness goal, or sensible defaults if none set
exports.getFitnessGoal = async (req, res) => {
  try {
    const goal = await FitnessGoal.findOne({ userId: req.user._id, isActive: true }).lean();
    res.json({ success: true, goal: goal || { ...DEFAULT_WEEKLY_GOAL, isDefault: true } });
  } catch (error) {
    console.error('Get fitness goal error:', error);
    res.status(500).json({ success: false, message: 'Failed to get fitness goal', error: error.message });
  }
};

// Create/update the user's active weekly fitness goal
exports.upsertFitnessGoal = async (req, res) => {
  try {
    const { weeklyMinutesTarget, weeklyCaloriesTarget, weeklyDistanceKmTarget } = req.body;

    const goal = await FitnessGoal.findOneAndUpdate(
      { userId: req.user._id, isActive: true },
      {
        userId: req.user._id,
        isActive: true,
        ...(weeklyMinutesTarget !== undefined && { weeklyMinutesTarget: Number(weeklyMinutesTarget) }),
        ...(weeklyCaloriesTarget !== undefined && { weeklyCaloriesTarget: Number(weeklyCaloriesTarget) }),
        ...(weeklyDistanceKmTarget !== undefined && { weeklyDistanceKmTarget: Number(weeklyDistanceKmTarget) })
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, goal, message: 'Fitness goal saved' });
  } catch (error) {
    console.error('Upsert fitness goal error:', error);
    res.status(500).json({ success: false, message: 'Failed to save fitness goal', error: error.message });
  }
};

// Get trends over a longer range (aggregated by day)
exports.getTrends = async (req, res) => {
  try {
    const { range } = req.query; // '4weeks' | '3months'
    const days = range === '3months' ? 90 : 28;

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const dailyTrend = await withTimeout(ExerciseLog.aggregate([
      { $match: { userId: req.user._id, timestamp: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          totalCalories: { $sum: '$caloriesBurned' },
          totalDuration: { $sum: '$duration' },
          sessionCount: { $sum: 1 },
          avgHeartRate: { $avg: '$avgHeartRate' },
          maxHeartRate: { $max: '$maxHeartRate' }
        }
      },
      { $sort: { _id: 1 } }
    ]));

    const byType = await withTimeout(ExerciseLog.aggregate([
      { $match: { userId: req.user._id, timestamp: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$activityType',
          totalCalories: { $sum: '$caloriesBurned' },
          totalDuration: { $sum: '$duration' },
          sessionCount: { $sum: 1 },
          avgHeartRate: { $avg: '$avgHeartRate' },
          maxHeartRate: { $max: '$maxHeartRate' }
        }
      },
      { $sort: { sessionCount: -1 } }
    ]));

    res.json({
      success: true,
      dailyTrend: dailyTrend.map((d) => ({
        date: d._id,
        totalCalories: d.totalCalories,
        totalDuration: d.totalDuration,
        sessionCount: d.sessionCount,
        avgHeartRate: d.avgHeartRate ? Math.round(d.avgHeartRate) : null,
        maxHeartRate: d.maxHeartRate || null
      })),
      byType: byType.map((t) => ({
        activityType: t._id,
        totalCalories: t.totalCalories,
        totalDuration: t.totalDuration,
        sessionCount: t.sessionCount,
        avgHeartRate: t.avgHeartRate ? Math.round(t.avgHeartRate) : null,
        maxHeartRate: t.maxHeartRate || null
      }))
    });
  } catch (error) {
    console.error('Get exercise trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trends',
      error: error.message
    });
  }
};

// Get trends bucketed by calendar week (Mon-Sun), with weekly average/best-week/
// %-vs-last-week per metric — for a weekly trends view, distinct from getTrends'
// daily granularity
exports.getWeeklyTrends = async (req, res) => {
  try {
    const weeks = Math.min(12, Math.max(1, parseInt(req.query.weeks) || 4));

    // Monday-start week boundaries
    const startOfWeek = (d) => {
      const date = new Date(d);
      date.setUTCHours(0, 0, 0, 0);
      const day = date.getUTCDay(); // 0=Sun..6=Sat
      const diff = day === 0 ? -6 : 1 - day;
      date.setUTCDate(date.getUTCDate() + diff);
      return date;
    };

    const thisWeekStart = startOfWeek(new Date());
    const rangeStart = new Date(thisWeekStart);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - (weeks - 1) * 7);

    const [logs, goal] = await Promise.all([
      withTimeout(ExerciseLog.find({
        userId: req.user._id,
        timestamp: { $gte: rangeStart }
      }).select('timestamp duration caloriesBurned distance category').lean()),
      FitnessGoal.findOne({ userId: req.user._id, isActive: true }).lean()
    ]);

    const weekBuckets = [];
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(rangeStart);
      weekStart.setUTCDate(weekStart.getUTCDate() + i * 7);
      weekBuckets.push({
        weekStart: weekStart.toISOString().split('T')[0],
        weekLabel: weekStart.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        totalDuration: 0,
        totalCalories: 0,
        totalDistance: 0,
        sessionCount: 0,
        byType: { cardio: 0, strength: 0, flexibility: 0, other: 0 }
      });
    }
    weekBuckets[weekBuckets.length - 1].weekLabel = 'This week';

    for (const log of logs) {
      const daysSinceRangeStart = Math.floor((new Date(log.timestamp) - rangeStart) / (24 * 60 * 60 * 1000));
      const weekIndex = Math.floor(daysSinceRangeStart / 7);
      if (weekIndex < 0 || weekIndex >= weeks) continue;

      const bucket = weekBuckets[weekIndex];
      bucket.totalDuration += Number(log.duration) || 0;
      bucket.totalCalories += Number(log.caloriesBurned) || 0;
      bucket.totalDistance += Number(log.distance) || 0;
      bucket.sessionCount += 1;
      const category = log.category || 'other';
      bucket.byType[category] = (bucket.byType[category] || 0) + (Number(log.duration) || 0);
    }

    const buildSummary = (field) => {
      const values = weekBuckets.map((w) => w[field]);
      const weeklyAverage = Math.round(values.reduce((a, b) => a + b, 0) / weeks);
      const bestIndex = values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
      const thisWeekVal = values[values.length - 1];
      const lastWeekVal = values.length > 1 ? values[values.length - 2] : null;
      const pctVsLastWeek = lastWeekVal > 0
        ? Math.round(((thisWeekVal - lastWeekVal) / lastWeekVal) * 100)
        : null;

      return {
        weeklyAverage,
        bestWeek: { value: values[bestIndex], weekLabel: weekBuckets[bestIndex].weekLabel },
        pctVsLastWeek
      };
    };

    res.json({
      success: true,
      weeks: weekBuckets,
      summary: {
        duration: buildSummary('totalDuration'),
        calories: buildSummary('totalCalories'),
        distance: buildSummary('totalDistance'),
        sessions: buildSummary('sessionCount')
      },
      goal: goal || DEFAULT_WEEKLY_GOAL
    });
  } catch (error) {
    console.error('Get weekly trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get weekly trends',
      error: error.message
    });
  }
};

// Get personal records per activity type
exports.getPersonalRecords = async (req, res) => {
  try {
    const cacheKey = `exercise_prs:${req.user._id}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, personalRecords: cached, cached: true });
    }

    const [cardioBests, strengthBests] = await Promise.all([
      withTimeout(ExerciseLog.aggregate([
        { $match: { userId: req.user._id, category: 'cardio' } },
        {
          $group: {
            _id: '$activityType',
            longestDistance: { $max: '$distance' },
            longestDuration: { $max: '$duration' },
            bestPace: { $min: '$avgPace' },
            mostCalories: { $max: '$caloriesBurned' }
          }
        }
      ])),
      withTimeout(ExerciseLog.aggregate([
        { $match: { userId: req.user._id, category: 'strength' } },
        { $unwind: '$exercises' },
        { $unwind: '$exercises.sets' },
        {
          $group: {
            _id: '$exercises.name',
            heaviestWeight: { $max: '$exercises.sets.weight' },
            maxReps: { $max: '$exercises.sets.reps' }
          }
        }
      ]))
    ]);

    const personalRecords = {
      cardio: cardioBests.map((c) => ({
        activityType: c._id,
        longestDistance: c.longestDistance || 0,
        longestDuration: c.longestDuration || 0,
        bestPace: c.bestPace || null,
        mostCalories: c.mostCalories || 0
      })),
      strength: strengthBests.map((s) => ({
        exerciseName: s._id,
        heaviestWeight: s.heaviestWeight || 0,
        maxReps: s.maxReps || 0
      }))
    };

    await cache.set(cacheKey, personalRecords, 10 * 60);

    res.json({ success: true, personalRecords });
  } catch (error) {
    console.error('Get personal records error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get personal records',
      error: error.message
    });
  }
};

// Get one session's full detail: HR zones, comparison to the user's rolling
// average for that activity type, and that day's nutrition offset
exports.getSessionInsight = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await ExerciseLog.findOne({ _id: id, userId: req.user._id }).lean();

    if (!log) {
      return res.status(404).json({ success: false, message: 'Exercise log not found' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dayStart = new Date(log.timestamp);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [rollingAvg, nutritionSummary] = await Promise.all([
      withTimeout(ExerciseLog.aggregate([
        {
          $match: {
            userId: req.user._id,
            activityType: log.activityType,
            timestamp: { $gte: thirtyDaysAgo },
            _id: { $ne: log._id }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$duration' },
            avgCalories: { $avg: '$caloriesBurned' },
            avgHeartRate: { $avg: '$avgHeartRate' },
            sessionCount: { $sum: 1 }
          }
        }
      ])),
      withTimeout(NutritionSummary.findOne({ userId: req.user._id, date: dayStart }).lean())
    ]);

    const comparison = rollingAvg[0]
      ? {
          avgDuration: Math.round(rollingAvg[0].avgDuration || 0),
          avgCalories: Math.round(rollingAvg[0].avgCalories || 0),
          avgHeartRate: rollingAvg[0].avgHeartRate ? Math.round(rollingAvg[0].avgHeartRate) : null,
          sessionCount: rollingAvg[0].sessionCount
        }
      : null;

    const zones = log.heartRateZones || null;
    const totalZoneMinutes = zones
      ? Object.values(zones).reduce((sum, v) => sum + (v || 0), 0)
      : 0;
    const heartRateZonePercent = zones && totalZoneMinutes > 0
      ? Object.fromEntries(
          Object.entries(zones).map(([k, v]) => [k, Math.round(((v || 0) / totalZoneMinutes) * 100)])
        )
      : null;

    res.json({
      success: true,
      session: log,
      heartRateZonePercent,
      totalVolumeKg: log.category === 'strength' ? computeSessionVolumeKg(log.exercises) : null,
      comparison,
      nutrition: nutritionSummary
        ? {
            caloriesConsumed: nutritionSummary.totalCalories,
            calorieGoal: nutritionSummary.calorieGoal,
            caloriesBurned: nutritionSummary.caloriesBurned
          }
        : null
    });
  } catch (error) {
    console.error('Get session insight error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session insight',
      error: error.message
    });
  }
};

// Internal helper: recompute a day's ExerciseSummary from ExerciseLog entries
exports.updateDailyExerciseSummaryInternal = updateDailyExerciseSummary;
async function updateDailyExerciseSummary(userId, date) {
  try {
    const targetDate = parseDayParam(date);
    const nextDay = new Date(targetDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const [logs, existingSummary] = await Promise.all([
      ExerciseLog.find({ userId, timestamp: { $gte: targetDate, $lt: nextDay } }).lean(),
      ExerciseSummary.findOne({ userId, date: targetDate })
    ]);

    const totals = {
      totalDuration: 0,
      totalCaloriesBurned: 0,
      sessionsCount: logs.length,
      totalDistance: 0,
      avgHeartRate: 0
    };
    const sessionsByType = {};
    let heartRateSum = 0;
    let heartRateCount = 0;

    for (const log of logs) {
      totals.totalDuration += Number(log.duration) || 0;
      totals.totalCaloriesBurned += Number(log.caloriesBurned) || 0;
      totals.totalDistance += Number(log.distance) || 0;
      if (log.avgHeartRate) {
        heartRateSum += log.avgHeartRate;
        heartRateCount++;
      }
      sessionsByType[log.activityType] = (sessionsByType[log.activityType] || 0) + 1;
    }

    totals.avgHeartRate = heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : 0;

    const targetDateStr = targetDate.toISOString().split('T')[0];

    if (existingSummary) {
      Object.assign(existingSummary, totals, { sessionsByType });
      await existingSummary.save();
      triggerDailyScoreRecompute(userId, targetDateStr);
      return existingSummary;
    }

    const newSummary = new ExerciseSummary({ userId, date: targetDate, ...totals, sessionsByType });
    await newSummary.save();
    triggerDailyScoreRecompute(userId, targetDateStr);
    return newSummary;
  } catch (error) {
    console.error('Update daily exercise summary error:', error);
    return null;
  }
}
